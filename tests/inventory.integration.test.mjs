import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after, beforeEach } from "node:test";
import { ObjectId } from "mongodb";
import {
  assertIsolatedDatabase,
  configureTestDatabase,
  dropTestDatabase,
} from "./support/test-db.mjs";

const testDbName = configureTestDatabase({ transactions: "auto" });
const hasMongo = Boolean(testDbName);
const SHIPPING = {
  fullName: "Inventory Test Buyer",
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
let inventory;
let orders;
let products;
let transactionSupport = false;

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  inventory = await import("../src/lib/services/inventory.ts");
  orders = await import("../src/lib/services/orders.ts");
  products = await import("../src/lib/services/products.ts");
  const transactions = await import("../src/lib/db/transactions.ts");
  transactionSupport = await transactions.supportsTransactions();
}

const dbTest = hasMongo && transactionSupport ? test : test.skip;

function newCheckoutKey() {
  return `inventory-${randomBytes(12).toString("hex")}`;
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

function testAdmin(overrides = {}) {
  return {
    ...testUser("admin"),
    role: "admin",
    ...overrides,
  };
}

function categoryDoc() {
  const suffix = randomBytes(4).toString("hex");
  const now = new Date();
  return {
    _id: new ObjectId(),
    name: `Inventory Category ${suffix}`,
    slug: `inventory-category-${suffix}`,
    tagline: "Test category",
    description: "Test category",
    icon: "speaker",
    imageUrl: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

function productDoc(overrides = {}) {
  const now = new Date();
  const suffix = randomBytes(5).toString("hex");
  return {
    _id: new ObjectId(),
    name: `Inventory Product ${suffix}`,
    slug: `inventory-product-${suffix}`,
    sku: `INV-${suffix}`,
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

function productPayload(categoryId, overrides = {}) {
  return {
    name: "Created inventory product",
    slug: `created-inventory-${randomBytes(4).toString("hex")}`,
    sku: `CREATED-${randomBytes(4).toString("hex")}`,
    summary: "Created product",
    description: "Created product",
    highlights: [],
    tags: [],
    priceInCents: 1200,
    compareAtPriceInCents: null,
    categoryId: categoryId.toHexString(),
    images: [],
    stock: 5,
    badge: null,
    featured: false,
    active: true,
    ...overrides,
  };
}

async function insertCategory() {
  const category = categoryDoc();
  await collections.categoriesCollection.insertOne(category);
  return category;
}

async function insertProduct(overrides = {}) {
  const product = productDoc(overrides);
  await collections.productsCollection.insertOne(product);
  return product;
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

async function getAdjustments(productId) {
  return await collections.inventoryAdjustmentsCollection
    .find({ productId })
    .sort({ at: 1, _id: 1 })
    .toArray();
}

async function setAuditValidator(validator) {
  try {
    await db.command({
      collMod: "inventoryAdjustments",
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  } catch (error) {
    if (error?.codeName !== "NamespaceNotFound") {
      throw error;
    }

    await db.createCollection("inventoryAdjustments", {
      validator,
      validationLevel: "strict",
      validationAction: "error",
    });
  }
}

async function resetAuditValidator() {
  try {
    await db.command({
      collMod: "inventoryAdjustments",
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

async function clearCatalog() {
  await Promise.all(
    [
      "orders",
      "products",
      "carts",
      "coupons",
      "categories",
      "inventoryAdjustments",
    ].map((name) => db.collection(name).deleteMany({})),
  );
}

if (hasMongo) {
  await db.command({ ping: 1 });

  beforeEach(async () => {
    assertIsolatedDatabase(db.databaseName);
    await clearCatalog();
    await resetAuditValidator();
    await collections.ensureCatalogIndexes();
  });

  after(async () => {
    await dropTestDatabase(db, testDbName);
    await mongoClient.close();
  });
}

dbTest("product edits preserve current stock and create no stock audit", async () => {
  const category = await insertCategory();
  const product = await insertProduct({
    stock: 10,
    categoryId: category._id,
  });

  const updated = await products.updateProduct(product._id.toHexString(), {
    name: "Renamed inventory product",
    stock: 999,
  });

  assert.equal(updated.name, "Renamed inventory product");
  assert.equal(updated.stock, 10);

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 10);
  assert.equal("stockAdjustments" in raw, false);
  assert.equal((await getAdjustments(product._id)).length, 0);
});

dbTest("product creation records a durable initial stock audit", async () => {
  const category = await insertCategory();
  const admin = testAdmin();

  const created = await products.createProduct(
    productPayload(category._id, { stock: 5 }),
    admin,
  );

  assert.equal(created.stock, 5);
  const productId = new ObjectId(created.id);
  const raw = await getProduct(productId);
  assert.equal("stockAdjustments" in raw, false);

  const adjustments = await getAdjustments(productId);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].adminUserId, admin.id);
  assert.equal(adjustments[0].kind, "initial");
  assert.equal(adjustments[0].delta, 5);
  assert.equal(adjustments[0].beforeStock, 0);
  assert.equal(adjustments[0].afterStock, 5);
  assert.equal(adjustments[0].reason, "Initial stock on product creation");
  assert.ok(adjustments[0].at instanceof Date);
});

dbTest("zero-stock product creation does not create an initial audit", async () => {
  const category = await insertCategory();
  const admin = testAdmin();

  const created = await products.createProduct(
    productPayload(category._id, { stock: 0 }),
    admin,
  );

  assert.equal(created.stock, 0);
  assert.equal(
    (await getAdjustments(new ObjectId(created.id))).length,
    0,
  );
});

dbTest("a successful adjustment writes a durable audit and ignores a body actor", async () => {
  const product = await insertProduct({ stock: 10 });
  const admin = testAdmin();

  const result = await inventory.adjustProductStock(
    product._id.toHexString(),
    admin,
    {
      expectedStock: 10,
      delta: 2,
      reason: "Restock shipment",
      adminUserId: "spoofed-client-id",
    },
  );

  assert.equal(result.product.stock, 12);
  assert.equal(result.adjustment.adminUserId, admin.id);
  assert.equal(result.adjustment.kind, "manual");
  assert.equal(result.adjustment.delta, 2);
  assert.equal(result.adjustment.beforeStock, 10);
  assert.equal(result.adjustment.afterStock, 12);
  assert.equal(result.adjustment.reason, "Restock shipment");

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 12);
  assert.equal("stockAdjustments" in raw, false);

  const adjustments = await getAdjustments(product._id);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0]._id.toHexString(), result.adjustment.id);
  assert.equal(adjustments[0].adminUserId, admin.id);
  assert.notEqual(adjustments[0].adminUserId, "spoofed-client-id");
  assert.equal(adjustments[0].beforeStock, 10);
  assert.equal(adjustments[0].afterStock, 12);
  assert.ok(adjustments[0].at instanceof Date);
});

dbTest("a stale expected stock is rejected without changing stock or writing audit", async () => {
  const product = await insertProduct({ stock: 10 });
  const admin = testAdmin();

  await assert.rejects(
    inventory.adjustProductStock(product._id.toHexString(), admin, {
      expectedStock: 9,
      delta: 1,
      reason: "Stale restock",
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "STOCK_CONFLICT");
      return true;
    },
  );

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 10);
  assert.equal((await getAdjustments(product._id)).length, 0);
});

dbTest("invalid and below-zero adjustments are rejected without mutation", async () => {
  const product = await insertProduct({ stock: 2 });
  const admin = testAdmin();
  const invalidPayloads = [
    { expectedStock: 2, delta: -3, reason: "Too many sold" },
    { expectedStock: 2, delta: 0, reason: "No change" },
    { expectedStock: 2.5, delta: 1, reason: "Fractional expected" },
    { expectedStock: 2, delta: 1, reason: "" },
  ];

  for (const payload of invalidPayloads) {
    await assert.rejects(
      inventory.adjustProductStock(
        product._id.toHexString(),
        admin,
        payload,
      ),
      (error) => {
        assert.equal(error.status, 400);
        return true;
      },
    );
  }

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 2);
  assert.equal((await getAdjustments(product._id)).length, 0);
});

dbTest("a non-admin actor cannot adjust stock", async () => {
  const product = await insertProduct({ stock: 10 });

  await assert.rejects(
    inventory.adjustProductStock(product._id.toHexString(), testUser(), {
      expectedStock: 10,
      delta: 1,
      reason: "Should be forbidden",
    }),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    },
  );

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 10);
  assert.equal((await getAdjustments(product._id)).length, 0);
});

dbTest("a non-admin actor cannot create a product with initial stock", async () => {
  const category = await insertCategory();

  await assert.rejects(
    products.createProduct(productPayload(category._id, { stock: 5 }), testUser()),
    (error) => {
      assert.equal(error.status, 403);
      return true;
    },
  );

  assert.equal(await collections.productsCollection.countDocuments({}), 0);
  assert.equal(
    await collections.inventoryAdjustmentsCollection.countDocuments({}),
    0,
  );
});

dbTest("checkout reservation makes an admin's earlier expected stock stale", async () => {
  const user = testUser("checkout");
  const product = await insertProduct({ stock: 2 });
  const admin = testAdmin();
  await setCart(user.id, [[product._id, 2]]);

  await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: newCheckoutKey(),
  });
  assert.equal((await getProduct(product._id)).stock, 0);

  await assert.rejects(
    inventory.adjustProductStock(product._id.toHexString(), admin, {
      expectedStock: 2,
      delta: 1,
      reason: "Admin had a stale page",
    }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, "STOCK_CONFLICT");
      return true;
    },
  );
  assert.equal((await getProduct(product._id)).stock, 0);
  assert.equal((await getAdjustments(product._id)).length, 0);

  const restocked = await inventory.adjustProductStock(
    product._id.toHexString(),
    admin,
    {
      expectedStock: 0,
      delta: 5,
      reason: "Received replacement stock",
    },
  );
  assert.equal(restocked.product.stock, 5);
  assert.equal(restocked.adjustment.beforeStock, 0);
  assert.equal(restocked.adjustment.afterStock, 5);
  assert.equal((await getAdjustments(product._id)).length, 1);
});

dbTest("parallel checkout and admin adjustment cannot lose an update or oversell", async () => {
  const user = testUser("parallel");
  const product = await insertProduct({ stock: 5 });
  const admin = testAdmin();
  await setCart(user.id, [[product._id, 5]]);

  const [orderResult, adjustmentResult] = await Promise.allSettled([
    orders.createOrder(user, {
      shipping: SHIPPING,
      checkoutKey: newCheckoutKey(),
    }),
    inventory.adjustProductStock(product._id.toHexString(), admin, {
      expectedStock: 5,
      delta: -2,
      reason: "Damaged units removed",
    }),
  ]);

  const orderSucceeded = orderResult.status === "fulfilled";
  const adjustmentSucceeded = adjustmentResult.status === "fulfilled";
  const raw = await getProduct(product._id);
  const expectedStock = 5 - (orderSucceeded ? 5 : 0) - (adjustmentSucceeded ? 2 : 0);
  const adjustments = await getAdjustments(product._id);

  assert.equal(raw.stock, expectedStock);
  assert.ok(raw.stock >= 0);
  assert.equal(adjustments.length, adjustmentSucceeded ? 1 : 0);

  if (!orderSucceeded) {
    assert.equal(orderResult.reason.status, 409);
  }

  if (!adjustmentSucceeded) {
    assert.equal(adjustmentResult.reason.status, 409);
    assert.equal(adjustmentResult.reason.code, "STOCK_CONFLICT");
  }
});

dbTest("two adjustments with the same expected stock apply exactly once", async () => {
  const product = await insertProduct({ stock: 10 });
  const admin = testAdmin();
  const payload = {
    expectedStock: 10,
    delta: 1,
    reason: "Concurrent restock",
  };

  const results = await Promise.allSettled([
    inventory.adjustProductStock(product._id.toHexString(), admin, payload),
    inventory.adjustProductStock(product._id.toHexString(), admin, payload),
  ]);
  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");

  assert.equal(fulfilled.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.status, 409);
  assert.equal(rejected[0].reason.code, "STOCK_CONFLICT");

  const raw = await getProduct(product._id);
  assert.equal(raw.stock, 11);
  const adjustments = await getAdjustments(product._id);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].adminUserId, admin.id);
});

dbTest("audit history is not capped at 1,000 records", async () => {
  const product = await insertProduct({ stock: 10 });
  const admin = testAdmin();
  const now = Date.now();
  const seeded = Array.from({ length: 1_005 }, (_, index) => ({
    _id: new ObjectId(),
    productId: product._id,
    adminUserId: `seed-admin-${index}`,
    kind: "manual",
    delta: 1,
    beforeStock: index,
    afterStock: index + 1,
    reason: `Seeded audit ${index}`,
    at: new Date(now - (1_005 - index) * 1_000),
  }));

  await collections.inventoryAdjustmentsCollection.insertMany(seeded);

  await inventory.adjustProductStock(product._id.toHexString(), admin, {
    expectedStock: 10,
    delta: 2,
    reason: "Adjustment after long history",
  });

  assert.equal(await collections.inventoryAdjustmentsCollection.countDocuments({
    productId: product._id,
  }), 1_006);
  assert.ok(
    await collections.inventoryAdjustmentsCollection.findOne({
      _id: seeded[0]._id,
    }),
    "the oldest audit record must remain",
  );
});

dbTest("audit insertion failure rolls back the stock adjustment", async () => {
  const product = await insertProduct({ stock: 10 });
  const admin = testAdmin();

  await setAuditValidator({
    $jsonSchema: { required: ["__forceAuditInsertFailure"] },
  });

  try {
    await assert.rejects(
      inventory.adjustProductStock(product._id.toHexString(), admin, {
        expectedStock: 10,
        delta: 2,
        reason: "Must roll back",
      }),
    );
  } finally {
    await resetAuditValidator();
  }

  assert.equal((await getProduct(product._id)).stock, 10);
  assert.equal((await getAdjustments(product._id)).length, 0);
});

dbTest("initial stock audit failure rolls back product creation", async () => {
  const category = await insertCategory();
  const admin = testAdmin();

  await setAuditValidator({
    $jsonSchema: { required: ["__forceAuditInsertFailure"] },
  });

  try {
    await assert.rejects(
      products.createProduct(productPayload(category._id, { stock: 5 }), admin),
    );
  } finally {
    await resetAuditValidator();
  }

  assert.equal(await collections.productsCollection.countDocuments({}), 0);
  assert.equal(
    await collections.inventoryAdjustmentsCollection.countDocuments({}),
    0,
  );
});
