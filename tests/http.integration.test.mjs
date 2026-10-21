import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import test, { after, before } from "node:test";
import { ObjectId } from "mongodb";
import {
  assertIsolatedDatabase,
  configureTestDatabase,
  dropTestDatabase,
} from "./support/test-db.mjs";

const enabled =
  (process.env.SHOPSPHERE_HTTP_TESTS === "1" ||
    process.env.npm_lifecycle_event === "test:http") &&
  existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
const httpTest = enabled ? test : test.skip;
const testDbName = enabled ? configureTestDatabase() : null;

let db;
let mongoClient;
let collections;
let orders;
let server;
let baseUrl;
let serverOutput = "";
let admin;
let customer;

function newCheckoutKey() {
  return `http-${randomBytes(12).toString("hex")}`;
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : null;
      probe.close(() => {
        if (!port) reject(new Error("Could not allocate a test port."));
        else resolve(port);
      });
    });
  });
}

async function waitForServer(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Next.js exited early.\n${serverOutput}`);
    }

    try {
      const response = await fetch(`${baseUrl}/sign-in`, {
        signal: AbortSignal.timeout(2_000),
      });

      if (response.ok) return;
    } catch {
      // Server is still starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Next.js did not start in time.\n${serverOutput}`);
}

async function stopServer() {
  if (!server || server.exitCode !== null) return;

  server.kill();

  await Promise.race([
    once(server, "exit"),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);

  if (server.exitCode === null) {
    const killer = spawn(
      "taskkill",
      ["/pid", String(server.pid), "/T", "/F"],
      { stdio: "ignore", windowsHide: true },
    );
    await once(killer, "exit").catch(() => {});
  }
}

async function signUp(label) {
  const email = `${label}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}@example.test`;
  const response = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
    },
    body: JSON.stringify({
      name: `Test ${label}`,
      email,
      password: "Test-password-123!",
    }),
  });
  const body = await response.text();

  assert.equal(response.status, 200, body);
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.length > 0, "sign-up should set a session cookie");

  return {
    email,
    cookie: cookies.map((value) => value.split(";")[0]).join("; "),
  };
}

function userFor(doc) {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    email: doc.email,
    emailVerified: true,
    image: null,
    phone: null,
    role: doc.role === "admin" ? "admin" : "customer",
    createdAt: new Date().toISOString(),
  };
}

async function seedCart(userId, items) {
  const now = new Date();
  await collections.cartsCollection.insertOne({
    _id: new ObjectId(),
    userId,
    items: items.map(([productId, quantity]) => ({
      productId,
      quantity,
      addedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  });
}

async function get(pathname, cookie) {
  return await fetch(`${baseUrl}${pathname}`, {
    headers: cookie ? { cookie } : {},
    redirect: "manual",
  });
}

if (enabled) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  orders = await import("../src/lib/services/orders.ts");

  before(async () => {
    assertIsolatedDatabase(db.databaseName);
    await collections.ensureCatalogIndexes();

    const suffix = randomBytes(4).toString("hex");
    const now = new Date();
    const lowStock = {
      _id: new ObjectId(),
      name: `Low Stock Fixture ${suffix}`,
      slug: `low-stock-fixture-${suffix}`,
      sku: `LOW-${suffix}`,
      summary: "Low stock fixture",
      description: "Low stock fixture",
      highlights: [],
      tags: [],
      priceInCents: 2500,
      compareAtPriceInCents: null,
      categoryId: new ObjectId(),
      images: [],
      stock: 2,
      badge: null,
      featured: false,
      active: true,
      ratingAverage: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const normalStock = {
      ...lowStock,
      _id: new ObjectId(),
      name: `Normal Stock Fixture ${suffix}`,
      slug: `normal-stock-fixture-${suffix}`,
      sku: `NORMAL-${suffix}`,
      stock: 20,
    };
    await collections.productsCollection.insertMany([lowStock, normalStock]);

    const port = await freePort();
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(
      process.execPath,
      [
        path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next"),
        "start",
        "-H",
        "127.0.0.1",
        "-p",
        String(port),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          NODE_ENV: "production",
          MONGODB_DB: testDbName,
          MONGODB_TRANSACTIONS: "off",
          BETTER_AUTH_URL: baseUrl,
        },
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      },
    );
    server.stdout.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    server.stderr.on("data", (chunk) => {
      serverOutput += chunk.toString();
    });
    await waitForServer();

    admin = await signUp("admin");
    customer = await signUp("customer");

    const adminDoc = await collections.usersCollection.findOne({
      email: admin.email,
    });
    assert.ok(adminDoc, "admin test user should exist");
    await collections.usersCollection.updateOne(
      { _id: adminDoc._id },
      { $set: { role: "admin" } },
    );

    const customerDoc = await collections.usersCollection.findOne({
      email: customer.email,
    });
    assert.ok(customerDoc, "customer test user should exist");
    const customerUser = userFor(customerDoc);
    await seedCart(customerUser.id, [[lowStock._id, 1]]);
    const order = await orders.createOrder(customerUser, {
      shipping: {
        fullName: "HTTP Test Buyer",
        line1: "1 Test Street",
        line2: "",
        city: "Testville",
        state: "Test State",
        postalCode: "12345",
        country: "Testland",
        phone: "",
      },
      checkoutKey: newCheckoutKey(),
    });
    await orders.updateOrderStatus(order.id, "confirmed");
    customer.orderId = order.id;
    customer.orderNumber = order.orderNumber;
    customer.lowStockName = lowStock.name;
  });

  after(async () => {
    await stopServer();
    await dropTestDatabase(db);
    await mongoClient.close();
  });
}

httpTest("unauthenticated requests receive 401 and non-admin requests receive 403", async () => {
  const unauthOrders = await get("/api/orders");
  assert.equal(unauthOrders.status, 401);
  assert.equal((await unauthOrders.json()).error.code, "UNAUTHORIZED");

  const unauthAdmin = await get("/api/admin/orders");
  assert.equal(unauthAdmin.status, 401);
  assert.equal((await unauthAdmin.json()).error.code, "UNAUTHORIZED");

  const customerAdmin = await get("/api/admin/orders", customer.cookie);
  assert.equal(customerAdmin.status, 403);
  assert.equal((await customerAdmin.json()).error.code, "FORBIDDEN");

  const adminOrders = await get("/api/admin/orders", admin.cookie);
  assert.equal(adminOrders.status, 200);
  assert.ok(Array.isArray((await adminOrders.json()).orders));

  const checkout = await fetch(`${baseUrl}/api/checkout`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(checkout.status, 401);
});

httpTest("customer order API enforces ownership and keeps payment unpaid", async () => {
  const own = await get(`/api/orders/${customer.orderId}`, customer.cookie);
  assert.equal(own.status, 200);
  const ownBody = await own.json();
  assert.equal(ownBody.order.paymentStatus, "unpaid");
  assert.equal(ownBody.order.status, "confirmed");

  const notOwner = await get(`/api/orders/${customer.orderId}`, admin.cookie);
  assert.equal(notOwner.status, 404);

  const patchAsCustomer = await fetch(
    `${baseUrl}/api/admin/orders/${customer.orderId}`,
    {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        cookie: customer.cookie,
      },
      body: JSON.stringify({ status: "processing" }),
    },
  );
  assert.equal(patchAsCustomer.status, 403);

  const stillConfirmed = await get(
    `/api/orders/${customer.orderId}`,
    customer.cookie,
  );
  assert.equal((await stillConfirmed.json()).order.status, "confirmed");
});

httpTest("admin dashboard low-stock panel and order timeline render for a safe test session", async () => {
  const dashboard = await get("/admin", admin.cookie);
  assert.equal(dashboard.status, 200);
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /Inventory alerts/);
  assert.ok(dashboardHtml.includes(customer.lowStockName));

  // The admin layout is streamed inside Suspense, so a non-admin gets the
  // not-found UI without an admin-data leak rather than a changeable status.
  const customerDashboard = await get("/admin", customer.cookie);
  const customerDashboardHtml = await customerDashboard.text();
  assert.ok(!customerDashboardHtml.includes("ShopSphere admin"));
  assert.ok(!customerDashboardHtml.includes(customer.lowStockName));

  const customerOrderList = await get("/admin/orders", customer.cookie);
  const customerOrderListHtml = await customerOrderList.text();
  assert.ok(!customerOrderListHtml.includes(customer.orderNumber));

  const customerOrderDetail = await get(
    `/admin/orders/${customer.orderId}`,
    customer.cookie,
  );
  const customerOrderDetailHtml = await customerOrderDetail.text();
  assert.ok(!customerOrderDetailHtml.includes(customer.orderNumber));

  const orderPage = await get(
    `/account/orders/${customer.orderId}`,
    customer.cookie,
  );
  assert.equal(orderPage.status, 200);
  const orderHtml = await orderPage.text();
  assert.match(orderHtml, /Order tracking/);
  assert.match(orderHtml, /Pending/);
  assert.match(orderHtml, /Confirmed/);
  assert.match(orderHtml, /Payment/);
  assert.match(orderHtml, /unpaid/);

  const adminOrderPage = await get(
    `/admin/orders/${customer.orderId}`,
    admin.cookie,
  );
  assert.equal(adminOrderPage.status, 200);
  const adminOrderHtml = await adminOrderPage.text();
  assert.match(adminOrderHtml, /Status history/);
  assert.match(adminOrderHtml, /Payment/);
  assert.match(adminOrderHtml, /unpaid/);
});
