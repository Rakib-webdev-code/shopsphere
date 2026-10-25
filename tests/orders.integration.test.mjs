import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after, beforeEach } from "node:test";
import { ObjectId } from "mongodb";
import {
  assertIsolatedDatabase,
  configureTestDatabase,
  dropTestDatabase,
} from "./support/test-db.mjs";

const testDbName = configureTestDatabase();
const hasMongo = Boolean(testDbName);
const dbTest = hasMongo ? test : test.skip;
const SHIPPING = {
  fullName: "Integration Test Buyer",
  line1: "1 Test Street",
  line2: "",
  city: "Testville",
  state: "Test State",
  postalCode: "12345",
  country: "Testland",
  phone: "",
};

let db;
let mongoClient;
let collections;
let orders;
let cart;

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  orders = await import("../src/lib/services/orders.ts");
  cart = await import("../src/lib/services/cart.ts");
}

function newCheckoutKey(label = "checkout") {
  return `${label}-${randomBytes(12).toString("hex")}`;
}

function testUser(label = "buyer") {
  const suffix = randomBytes(4).toString("hex");
  return {
    id: `test-user-${label}-${suffix}`,
    name: "Test Buyer",
    email: `${label}-${suffix}@example.test`,
    emailVerified: true,
    image: null,
    phone: null,
    role: "customer",
    createdAt: new Date().toISOString(),
  };
}

function productDoc(overrides = {}) {
  const now = new Date();
  const suffix = randomBytes(5).toString("hex");
  return {
    _id: new ObjectId(),
    name: `Integration Product ${suffix}`,
    slug: `integration-product-${suffix}`,
    sku: `TEST-${suffix}`,
    summary: "Test product",
    description: "Test product",
    highlights: [],
    tags: [],
    priceInCents: 2500,
    compareAtPriceInCents: null,
    categoryId: new ObjectId(),
    images: [],
    stock: 10,
    badge: null,
    featured: false,
    active: true,
    ratingAverage: 0,
    ratingCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function couponDoc(overrides = {}) {
  const now = new Date();
  const suffix = randomBytes(4).toString("hex");
  return {
    _id: new ObjectId(),
    code: `TEST${suffix.toUpperCase()}`,
    description: "Integration test coupon",
    type: "percentage",
    value: 10,
    minSubtotalCents: 0,
    maxUses: 5,
    usedCount: 0,
    expiresAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function insertProduct(overrides) {
  const product = productDoc(overrides);
  await collections.productsCollection.insertOne(product);
  return product;
}

async function insertCoupon(overrides) {
  const coupon = couponDoc(overrides);
  await collections.couponsCollection.insertOne(coupon);
  return coupon;
}

async function setCart(userId, entries) {
  const now = new Date();
  await collections.cartsCollection.insertOne({
    _id: new ObjectId(),
    userId,
    items: entries.map(([productId, quantity]) => ({
      productId,
      quantity,
      addedAt: now,
    })),
    createdAt: now,
    updatedAt: now,
  });
}

async function getProduct(productId) {
  const product = await collections.productsCollection.findOne({
    _id: productId,
  });
  assert.ok(product, "product should still exist");
  return product;
}

async function getOrder(orderId) {
  const order = await collections.ordersCollection.findOne({
    _id: new ObjectId(orderId),
  });
  assert.ok(order, "order should exist");
  return order;
}

async function clearCatalog() {
  await Promise.all(
    ["orders", "products", "carts", "coupons", "addresses"].map((name) =>
      db.collection(name).deleteMany({}),
    ),
  );
}

async function resetValidators() {
  for (const name of ["orders", "products"]) {
    try {
      await db.command({
        collMod: name,
        validator: {},
        validationLevel: "strict",
        validationAction: "error",
      });
    } catch (error) {
      if (error?.codeName !== "NamespaceNotFound") {
        throw error;
      }
    }
  }
}

if (hasMongo) {
  await db.command({ ping: 1 });

  beforeEach(async () => {
    assertIsolatedDatabase(db.databaseName);
    await clearCatalog();
    await resetValidators();
    await collections.ensureCatalogIndexes();
  });

  after(async () => {
    await dropTestDatabase(db, testDbName);
    await mongoClient.close();
  });
}

dbTest("invalid cart quantities are rejected before any stock changes", async () => {
  const user = testUser("quantities");
  const product = await insertProduct({ stock: 10 });

  for (const quantity of [0, -1, 1.5, 100]) {
    await collections.cartsCollection.deleteMany({ userId: user.id });
    await setCart(user.id, [[product._id, quantity]]);

    await assert.rejects(
      orders.createOrder(user, {
        shipping: SHIPPING,
        checkoutKey: newCheckoutKey("quantity"),
      }),
      (error) => {
        assert.equal(error.status, 400, `quantity ${quantity} should be 400`);
        return true;
      },
    );
  }

  // Quantity is valid but exceeds stock: a 409 conflict, still no mutation.
  await collections.cartsCollection.deleteMany({ userId: user.id });
  await setCart(user.id, [[product._id, 11]]);
  await assert.rejects(
    orders.createOrder(user, {
      shipping: SHIPPING,
      checkoutKey: newCheckoutKey("quantity"),
    }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );

  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  assert.equal(await collections.cartsCollection.countDocuments({ userId: user.id }), 1);
});

dbTest("a failed multi-line reservation releases the lines that already succeeded", async () => {
  const user = testUser("partial-reservation");
  const available = await insertProduct({ stock: 2 });
  const unavailable = await insertProduct({ stock: 1 });
  await setCart(user.id, [
    [available._id, 2],
    [unavailable._id, 2],
  ]);

  await assert.rejects(
    orders.createOrder(user, {
      shipping: SHIPPING,
      checkoutKey: newCheckoutKey("partial-reservation"),
    }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );

  assert.equal((await getProduct(available._id)).stock, 2);
  assert.equal((await getProduct(unavailable._id)).stock, 1);
  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  assert.equal(
    (await collections.cartsCollection.findOne({ userId: user.id })).items
      .length,
    2,
  );
});

dbTest("recovery fences a paused checkout before the worker can reserve later lines", async () => {
  const user = testUser("stale-worker");
  const first = await insertProduct({ stock: 5 });
  const second = await insertProduct({ stock: 5 });
  await setCart(user.id, [
    [first._id, 1],
    [second._id, 1],
  ]);

  let notifyEntered;
  let resumeWorker;
  const entered = new Promise((resolve) => {
    notifyEntered = resolve;
  });
  const paused = new Promise((resolve) => {
    resumeWorker = resolve;
  });
  const originalUpdateOne = collections.productsCollection.updateOne.bind(
    collections.productsCollection,
  );
  let shouldPause = true;
  collections.productsCollection.updateOne = async (filter, update, options) => {
    if (shouldPause && filter?._id?.equals(first._id) && update?.$inc?.stock < 0) {
      shouldPause = false;
      notifyEntered();
      await paused;
    }

    return originalUpdateOne(filter, update, options);
  };

  const checkoutKey = newCheckoutKey("stale-worker");
  const checkout = orders.createOrder(user, { shipping: SHIPPING, checkoutKey });

  try {
    await entered;
    const order = await collections.ordersCollection.findOne({
      userId: user.id,
      checkoutKey,
    });
    assert.ok(order);

    const staleAt = new Date(Date.now() - 120_000);
    await collections.ordersCollection.updateOne(
      { _id: order._id },
      {
        $set: {
          updatedAt: staleAt,
          "inventoryClaim.at": staleAt,
        },
      },
    );

    const recovered = await orders.recoverPendingInventoryReleases();
    assert.equal(recovered.aborted, 1);
    assert.equal((await getOrder(order._id.toHexString())).inventoryState, "released");

    // Let the old worker's first attempted update run after recovery has fenced
    // both product documents. It must fail without changing either stock.
    resumeWorker();
    await assert.rejects(checkout);
  } finally {
    resumeWorker();
    collections.productsCollection.updateOne = originalUpdateOne;
  }

  assert.equal((await getProduct(first._id)).stock, 5);
  assert.equal((await getProduct(second._id)).stock, 5);
  const firstAfter = await getProduct(first._id);
  const secondAfter = await getProduct(second._id);
  const finalOrder = await collections.ordersCollection.findOne({
    userId: user.id,
    checkoutKey,
  });
  assert.ok(finalOrder);
  assert.ok(firstAfter.inventoryRestorations?.some((entry) => entry.orderId.equals(finalOrder._id)));
  assert.ok(secondAfter.inventoryRestorations?.some((entry) => entry.orderId.equals(finalOrder._id)));
});

dbTest("force-release refuses a live claim and restores before its audited terminal transition", async () => {
  const user = testUser("force-release-race");
  const admin = { ...testUser("force-release-admin"), role: "admin" };
  const product = await insertProduct({ stock: 5 });
  await setCart(user.id, [[product._id, 1]]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: newCheckoutKey("force-release"),
  });
  const orderId = new ObjectId(order.id);
  const liveAt = new Date();

  await collections.ordersCollection.updateOne(
    { _id: orderId },
    {
      $set: {
        inventoryState: "reserving",
        inventoryClaim: { token: "live-worker", at: liveAt },
        reconciliationRequired: true,
      },
    },
  );

  await assert.rejects(
    orders.resolveOrderReconciliation(order.id, admin, "force-release"),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );
  assert.equal((await getProduct(product._id)).stock, 4);

  const staleAt = new Date(Date.now() - 120_000);
  await collections.ordersCollection.updateOne(
    { _id: orderId },
    { $set: { updatedAt: staleAt, "inventoryClaim.at": staleAt } },
  );

  const released = await orders.resolveOrderReconciliation(
    order.id,
    admin,
    "force-release",
  );
  assert.equal(released.inventoryState, "released");
  assert.equal(released.reconciliationRequired, false);
  assert.equal((await getProduct(product._id)).stock, 5);
  const finalOrder = await getOrder(order.id);
  assert.equal(finalOrder.reconciliationResolvedByAdminId, admin.id);
  assert.ok(finalOrder.statusHistory.some((event) => event.changedByAdminId === admin.id));
});

dbTest("duplicate checkout keys return one order and deduct once", async () => {
  const user = testUser("duplicate");
  const product = await insertProduct({ stock: 10 });
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [[product._id, 2]]);
  const checkoutKey = newCheckoutKey("sequential");

  const first = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey,
  });
  const second = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey,
  });

  assert.equal(second.id, first.id);
  assert.equal(first.status, "pending");
  assert.equal(first.paymentStatus, "unpaid");
  assert.equal(first.inventoryState, "reserved");
  assert.equal(first.statusHistory.length, 1);
  assert.equal((await getProduct(product._id)).stock, 8);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 1);
  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  const cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.deepEqual(cart.items, []);
});

dbTest("concurrent duplicate checkout keys create one order and restore the loser's stock", async () => {
  const user = testUser("concurrent-duplicate");
  const product = await insertProduct({ stock: 10 });
  await setCart(user.id, [[product._id, 2]]);
  const checkoutKey = newCheckoutKey("concurrent");

  const results = await Promise.all([
    orders.createOrder(user, { shipping: SHIPPING, checkoutKey }),
    orders.createOrder(user, { shipping: SHIPPING, checkoutKey }),
  ]);

  assert.equal(results[0].id, results[1].id);
  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  assert.equal((await getProduct(product._id)).stock, 8);
  const cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.deepEqual(cart.items, []);
  assert.equal(results[0].paymentStatus, "unpaid");
});

dbTest("checkout refuses to run when the idempotency index is missing", async () => {
  const user = testUser("missing-index");
  const product = await insertProduct({ stock: 10 });
  await setCart(user.id, [[product._id, 2]]);

  await collections.ordersCollection.dropIndex("orders_user_checkout_key_uidx");

  try {
    await assert.rejects(
      orders.createOrder(user, {
        shipping: SHIPPING,
        checkoutKey: newCheckoutKey("missing-index"),
      }),
      (error) => {
        assert.equal(error.status, 503);
        assert.equal(error.code, "CHECKOUT_NOT_READY");
        assert.match(error.message, /db:init/);
        return true;
      },
    );

    assert.equal((await getProduct(product._id)).stock, 10);
    assert.equal(await collections.ordersCollection.countDocuments({}), 0);
    const cart = await collections.cartsCollection.findOne({ userId: user.id });
    assert.equal(cart.items.length, 1);
  } finally {
    await collections.ensureCatalogIndexes();
  }

  // With the index restored, the same request succeeds.
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: newCheckoutKey("missing-index-retry"),
  });
  assert.equal(order.status, "pending");
  assert.equal((await getProduct(product._id)).stock, 8);
});

dbTest("stock and coupon reservations are compensated when order creation fails", async () => {
  const user = testUser("compensation");
  const product = await insertProduct({ stock: 10 });
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [[product._id, 2]]);
  const checkoutKey = newCheckoutKey("compensation");

  await db.command({
    collMod: "orders",
    validator: {
      $jsonSchema: { required: ["__forceInsertFailure"] },
    },
    validationLevel: "strict",
    validationAction: "error",
  });

  await assert.rejects(
    orders.createOrder(user, {
      shipping: SHIPPING,
      couponCode: coupon.code,
      checkoutKey,
    }),
  );

  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  let cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.equal(cart.items[0].quantity, 2);

  await resetValidators();

  // Retrying the exact same checkout key after the partial failure succeeds
  // exactly once.
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey,
  });

  assert.equal(order.status, "pending");
  assert.equal((await getProduct(product._id)).stock, 8);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 1);
  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.deepEqual(cart.items, []);
});

dbTest("status transitions follow the configured map and keep payment unpaid", async () => {
  const user = testUser("transitions");
  const product = await insertProduct({ stock: 10 });
  await setCart(user.id, [[product._id, 1]]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: newCheckoutKey("transitions"),
  });

  await assert.rejects(
    orders.updateOrderStatus(order.id, "shipped"),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );

  const confirmed = await orders.updateOrderStatus(order.id, "confirmed");
  assert.equal(confirmed.status, "confirmed");
  assert.equal(confirmed.paymentStatus, "unpaid");
  assert.deepEqual(
    confirmed.statusHistory.map((event) => event.status),
    ["pending", "confirmed"],
  );

  // Repeating the same status is a no-op rather than a duplicate event.
  const repeated = await orders.updateOrderStatus(order.id, "confirmed");
  assert.equal(repeated.statusHistory.length, 2);

  const processing = await orders.updateOrderStatus(order.id, "processing");
  assert.equal(processing.status, "processing");
  const shipped = await orders.updateOrderStatus(order.id, "shipped");
  assert.equal(shipped.status, "shipped");
  assert.equal(shipped.paymentStatus, "unpaid");

  await assert.rejects(
    orders.updateOrderStatus(order.id, "cancelled"),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );

  const delivered = await orders.updateOrderStatus(order.id, "delivered");
  assert.equal(delivered.status, "delivered");
  assert.equal(delivered.paymentStatus, "unpaid");
  assert.equal(delivered.inventoryState, "reserved");
  assert.deepEqual(
    delivered.statusHistory.map((event) => event.status),
    ["pending", "confirmed", "processing", "shipped", "delivered"],
  );
});

dbTest("cancellation restores stock and coupon use exactly once", async () => {
  const user = testUser("cancel");
  const product = await insertProduct({ stock: 10 });
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [[product._id, 2]]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey: newCheckoutKey("cancel"),
  });

  assert.equal((await getProduct(product._id)).stock, 8);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 1);

  const cancelled = await orders.updateOrderStatus(order.id, "cancelled");
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.inventoryState, "released");
  assert.equal(cancelled.paymentStatus, "unpaid");
  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
  assert.equal(
    cancelled.statusHistory.filter((event) => event.status === "cancelled").length,
    1,
  );

  const repeated = await orders.updateOrderStatus(order.id, "cancelled");
  assert.equal(repeated.status, "cancelled");
  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
  assert.equal(
    repeated.statusHistory.filter((event) => event.status === "cancelled").length,
    1,
  );
});

dbTest("concurrent cancellation restores stock only once", async () => {
  const user = testUser("concurrent-cancel");
  const products = [
    await insertProduct({ stock: 10 }),
    await insertProduct({ stock: 10 }),
  ];
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [
    [products[0]._id, 2],
    [products[1]._id, 3],
  ]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey: newCheckoutKey("concurrent-cancel"),
  });

  const results = await Promise.all([
    orders.updateOrderStatus(order.id, "cancelled"),
    orders.updateOrderStatus(order.id, "cancelled"),
  ]);

  assert.equal(results.every((entry) => entry.status === "cancelled"), true);
  assert.equal((await getProduct(products[0]._id)).stock, 10);
  assert.equal((await getProduct(products[1]._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
  const raw = await getOrder(order.id);
  assert.equal(raw.inventoryState, "released");
  assert.equal(
    raw.statusHistory.filter((event) => event.status === "cancelled").length,
    1,
  );
});

dbTest("a cancellation that fails mid-release is resumed without double restoring stock", async () => {
  const user = testUser("cancel-recovery");
  const product = await insertProduct({ stock: 10 });
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [[product._id, 2]]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey: newCheckoutKey("cancel-recovery"),
  });

  // Fail the stock restoration after the cancellation claim has been written.
  await db.command({
    collMod: "products",
    validator: { stock: { $lte: 9 } },
    validationLevel: "strict",
    validationAction: "error",
  });

  await assert.rejects(orders.updateOrderStatus(order.id, "cancelled"));

  let raw = await getOrder(order.id);
  assert.equal(raw.status, "cancelled");
  assert.equal(raw.inventoryState, "releasing");
  assert.equal((await getProduct(product._id)).stock, 8);
  // Coupon restoration is independent of stock restoration: the release pass
  // restores everything it can and leaves only the failed effect for recovery.
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);

  await resetValidators();

  // Retrying the same cancellation resumes the release.
  const recovered = await orders.updateOrderStatus(order.id, "cancelled");
  assert.equal(recovered.inventoryState, "released");
  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);

  const summary = await orders.recoverPendingInventoryReleases();
  assert.equal(summary.scanned, 0);
  assert.equal((await getProduct(product._id)).stock, 10);
});

dbTest("recovery skips items that were already restored before a crash", async () => {
  const user = testUser("partial-recovery");
  const productA = await insertProduct({ stock: 10 });
  const productB = await insertProduct({ stock: 10 });
  const coupon = await insertCoupon({ usedCount: 0 });
  await setCart(user.id, [
    [productA._id, 1],
    [productB._id, 2],
  ]);
  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey: newCheckoutKey("partial-recovery"),
  });
  const raw = await getOrder(order.id);

  // Simulate a crash after the claim and after restoring only product A. The
  // marker must be present exactly as the real restoration would leave it.
  await collections.ordersCollection.updateOne(
    { _id: raw._id },
    {
      $set: { status: "cancelled", inventoryState: "releasing" },
      $push: {
        statusHistory: {
          status: "cancelled",
          changedAt: new Date(),
          changedByAdminId: null,
        },
      },
    },
  );
  await collections.productsCollection.updateOne(
    { _id: productA._id },
    {
      $inc: { stock: 1 },
      $push: {
        inventoryRestorations: { orderId: raw._id, at: new Date() },
      },
    },
  );

  const summary = await orders.recoverPendingInventoryReleases();
  assert.equal(summary.scanned, 1);
  assert.equal(summary.released, 1);
  assert.equal(summary.failed.length, 0);
  assert.equal((await getProduct(productA._id)).stock, 10);
  assert.equal((await getProduct(productB._id)).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
  assert.equal((await getOrder(order.id)).inventoryState, "released");

  const second = await orders.recoverPendingInventoryReleases();
  assert.equal(second.scanned, 0);
  assert.equal((await getProduct(productA._id)).stock, 10);
  assert.equal((await getProduct(productB._id)).stock, 10);
});

dbTest("customer order ownership returns 404 while the explicit ownership check returns 403", async () => {
  const owner = testUser("owner");
  const other = testUser("other");
  const product = await insertProduct({ stock: 10 });
  await setCart(owner.id, [[product._id, 1]]);
  const order = await orders.createOrder(owner, {
    shipping: SHIPPING,
    checkoutKey: newCheckoutKey("ownership"),
  });

  const ownOrder = await orders.getOrderForUser(owner.id, order.id);
  assert.equal(ownOrder.id, order.id);

  await assert.rejects(
    orders.getOrderForUser(other.id, order.id),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    },
  );

  await assert.rejects(
    orders.assertOrderOwnership(other.id, order.id),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    },
  );

  const adminView = await orders.getOrderForAdmin(order.id);
  assert.equal(adminView.id, order.id);
});

dbTest("compensation checkout aborts instead of erasing a concurrent add", async () => {
  const user = testUser("race-add");
  const [purchased, added] = await Promise.all([
    insertProduct({ stock: 10 }),
    insertProduct({ stock: 10 }),
  ]);
  await setCart(user.id, [[purchased._id, 1]]);
  const originalInsert = collections.ordersCollection.insertOne.bind(
    collections.ordersCollection,
  );
  let triggered = false;

  collections.ordersCollection.insertOne = async (document, options) => {
    if (!triggered) {
      triggered = true;
      await cart.addCartItem(user.id, {
        productId: added._id.toHexString(),
        quantity: 1,
      });
    }

    return originalInsert(document, options);
  };

  try {
    await assert.rejects(
      orders.createOrder(user, { shipping: SHIPPING, checkoutKey: newCheckoutKey("race-add") }),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      },
    );
  } finally {
    collections.ordersCollection.insertOne = originalInsert;
  }

  // The durable checkout record is retained after a cart conflict so recovery
  // can prove the reservation was compensated. It is never fulfillable.
  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  const aborted = await collections.ordersCollection.findOne({});
  assert.equal(aborted.status, "cancelled");
  assert.equal(aborted.inventoryState, "released");
  assert.equal((await getProduct(purchased._id)).stock, 10);
  assert.equal((await getProduct(added._id)).stock, 10);
  const rawCart = await collections.cartsCollection.findOne({
    userId: user.id,
  });
  const quantities = new Map(
    rawCart.items.map((item) => [item.productId.toHexString(), item.quantity]),
  );
  assert.equal(quantities.get(purchased._id.toHexString()), 1);
  assert.equal(quantities.get(added._id.toHexString()), 1);
});

dbTest("compensation checkout aborts instead of purchasing a concurrently removed line", async () => {
  const user = testUser("race-remove");
  const product = await insertProduct({ stock: 10 });
  await setCart(user.id, [[product._id, 1]]);
  const originalInsert = collections.ordersCollection.insertOne.bind(
    collections.ordersCollection,
  );
  let triggered = false;

  collections.ordersCollection.insertOne = async (document, options) => {
    if (!triggered) {
      triggered = true;
      await cart.removeCartItem(user.id, product._id.toHexString());
    }

    return originalInsert(document, options);
  };

  try {
    await assert.rejects(
      orders.createOrder(user, { shipping: SHIPPING, checkoutKey: newCheckoutKey("race-remove") }),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      },
    );
  } finally {
    collections.ordersCollection.insertOne = originalInsert;
  }

  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  const aborted = await collections.ordersCollection.findOne({});
  assert.equal(aborted.status, "cancelled");
  assert.equal(aborted.inventoryState, "released");
  assert.equal((await getProduct(product._id)).stock, 10);
  const rawCart = await collections.cartsCollection.findOne({
    userId: user.id,
  });
  assert.deepEqual(rawCart.items, []);
});

dbTest("clearPurchasedCartItems clears only purchased quantities and preserves concurrent additions", async () => {
  const user = testUser("cart-clear-concurrent");
  const [purchased, added] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 20 }),
  ]);

  // User initially had purchased product with quantity 2
  await setCart(user.id, [[purchased._id, 2]]);

  // Concurrently, user adds another product and increases quantity of purchased product to 5
  await cart.addCartItem(user.id, { productId: added._id.toHexString(), quantity: 1 });
  await cart.updateCartItem(user.id, purchased._id.toHexString(), { quantity: 5 });

  // Clear for the order that bought 2 of purchased product
  await cart.clearPurchasedCartItems(user.id, [{ productId: purchased._id, quantity: 2 }]);

  const updatedCart = await collections.cartsCollection.findOne({ userId: user.id });
  const itemMap = new Map(updatedCart.items.map((i) => [i.productId.toHexString(), i.quantity]));

  // Remaining quantity of purchased product is 5 - 2 = 3
  assert.equal(itemMap.get(purchased._id.toHexString()), 3);
  // Concurrently added product is preserved with quantity 1
  assert.equal(itemMap.get(added._id.toHexString()), 1);

  // Now clear the remaining 3 units
  await cart.clearPurchasedCartItems(user.id, [{ productId: purchased._id, quantity: 3 }]);
  const clearedCart = await collections.cartsCollection.findOne({ userId: user.id });
  const clearedMap = new Map(clearedCart.items.map((i) => [i.productId.toHexString(), i.quantity]));

  // Purchased product is now removed
  assert.equal(clearedMap.get(purchased._id.toHexString()), undefined);
  // Added product is still preserved
  assert.equal(clearedMap.get(added._id.toHexString()), 1);
});

dbTest("reserving order with fresh claim returns CHECKOUT_IN_PROGRESS to prevent premature key rotation", async () => {
  const user = testUser("checkout-in-progress");
  const product = await insertProduct({ stock: 5 });
  await setCart(user.id, [[product._id, 1]]);

  const checkoutKey = newCheckoutKey("in-prog");
  const now = new Date();

  // Create an order in "reserving" state with a fresh claim
  await collections.ordersCollection.insertOne({
    _id: new ObjectId(),
    orderNumber: "SS-TEST-INPROGRESS",
    userId: user.id,
    customerEmail: user.email,
    items: [{
      productId: product._id,
      name: product.name,
      slug: product.slug,
      image: null,
      priceInCents: product.priceInCents,
      quantity: 1,
      lineTotalCents: product.priceInCents,
    }],
    shippingAddress: {
      label: "Shipping",
      fullName: "Test",
      line1: "123 St",
      line2: null,
      city: "City",
      state: "ST",
      postalCode: "12345",
      country: "US",
      phone: null,
    },
    subtotalCents: product.priceInCents,
    discountCents: 0,
    shippingCents: 0,
    totalCents: product.priceInCents,
    couponId: null,
    couponCode: null,
    status: "pending",
    paymentStatus: "unpaid",
    inventoryState: "reserving",
    inventoryClaim: { token: "active-token", at: now },
    checkoutKey,
    createdAt: now,
    updatedAt: now,
  });

  // Retrying with the same checkoutKey while reserving must return CHECKOUT_IN_PROGRESS
  await assert.rejects(
    orders.createOrder(user, { checkoutKey, shipping: SHIPPING }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "CHECKOUT_IN_PROGRESS");
      return true;
    },
  );
});

dbTest("deleted product during inventory release flags order as reconciliationRequired and avoids recovery starvation", async () => {
  const user = testUser("reconciliation-recovery");
  const admin = { ...testUser("admin-recon"), role: "admin" };
  const [productA, productB] = await Promise.all([
    insertProduct({ stock: 10 }),
    insertProduct({ stock: 10 }),
  ]);

  const now = new Date(Date.now() - 120_000); // 2 minutes ago (stale)

  // Order A has product A (which we will delete)
  const orderAId = new ObjectId();
  await collections.ordersCollection.insertOne({
    _id: orderAId,
    orderNumber: "SS-TEST-RECON-A",
    userId: user.id,
    customerEmail: user.email,
    items: [{
      productId: productA._id,
      name: productA.name,
      slug: productA.slug,
      image: null,
      priceInCents: productA.priceInCents,
      quantity: 2,
      lineTotalCents: productA.priceInCents * 2,
    }],
    shippingAddress: {
      label: "Shipping",
      fullName: "Test",
      line1: "123 St",
      line2: null,
      city: "City",
      state: "ST",
      postalCode: "12345",
      country: "US",
      phone: null,
    },
    subtotalCents: productA.priceInCents * 2,
    discountCents: 0,
    shippingCents: 0,
    totalCents: productA.priceInCents * 2,
    couponId: null,
    couponCode: null,
    status: "cancelled",
    paymentStatus: "unpaid",
    inventoryState: "releasing",
    inventoryClaim: null,
    reservationCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Order B has product B (which still exists)
  const orderBId = new ObjectId();
  await collections.ordersCollection.insertOne({
    _id: orderBId,
    orderNumber: "SS-TEST-RECON-B",
    userId: user.id,
    customerEmail: user.email,
    items: [{
      productId: productB._id,
      name: productB.name,
      slug: productB.slug,
      image: null,
      priceInCents: productB.priceInCents,
      quantity: 1,
      lineTotalCents: productB.priceInCents,
    }],
    shippingAddress: {
      label: "Shipping",
      fullName: "Test",
      line1: "123 St",
      line2: null,
      city: "City",
      state: "ST",
      postalCode: "12345",
      country: "US",
      phone: null,
    },
    subtotalCents: productB.priceInCents,
    discountCents: 0,
    shippingCents: 0,
    totalCents: productB.priceInCents,
    couponId: null,
    couponCode: null,
    status: "cancelled",
    paymentStatus: "unpaid",
    inventoryState: "releasing",
    inventoryClaim: null,
    reservationCompletedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Delete product A from the database
  await collections.productsCollection.deleteOne({ _id: productA._id });

  // Run recovery: Order A fails (product missing), Order B succeeds
  const recoveryResult = await orders.recoverPendingInventoryReleases(10);
  assert.equal(recoveryResult.failed.includes(orderAId.toHexString()), true);
  assert.equal(recoveryResult.released, 1);

  // Order A is durably marked reconciliationRequired
  const docA = await collections.ordersCollection.findOne({ _id: orderAId });
  assert.equal(docA.inventoryState, "releasing");
  assert.equal(docA.reconciliationRequired, true);
  assert.ok(docA.reconciliationError?.includes("no longer exists"));

  // Order B was successfully released
  const docB = await collections.ordersCollection.findOne({ _id: orderBId });
  assert.equal(docB.inventoryState, "released");
  assert.equal((await getProduct(productB._id)).stock, 11);

  // Subsequent recovery passes skip Order A so the queue does not starve
  const nextRecovery = await orders.recoverPendingInventoryReleases(10);
  assert.equal(nextRecovery.scanned, 0);

  // Non-admin cannot resolve reconciliation
  await assert.rejects(
    orders.resolveOrderReconciliation(orderAId.toHexString(), user, "force-release"),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    },
  );

  // Admin resolves reconciliation via force-release
  const resolved = await orders.resolveOrderReconciliation(
    orderAId.toHexString(),
    admin,
    "force-release",
  );
  assert.equal(resolved.inventoryState, "released");
  assert.equal(resolved.reconciliationRequired, false);

  const docAFinal = await collections.ordersCollection.findOne({ _id: orderAId });
  assert.equal(docAFinal.inventoryState, "released");
  assert.equal(docAFinal.reconciliationResolvedByAdminId, admin.id);
});
