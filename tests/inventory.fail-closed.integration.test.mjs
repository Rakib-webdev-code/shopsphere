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

let db;
let mongoClient;
let collections;
let inventory;
let products;
let transactionSupport = true;

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  inventory = await import("../src/lib/services/inventory.ts");
  products = await import("../src/lib/services/products.ts");
  const transactions = await import("../src/lib/db/transactions.ts");
  transactionSupport = await transactions.supportsTransactions();
}

function testAdmin() {
  const suffix = randomBytes(4).toString("hex");
  return {
    id: `fail-closed-admin-${suffix}`,
    name: "Fail Closed Admin",
    email: `fail-closed-${suffix}@example.test`,
    emailVerified: true,
    image: null,
    phone: null,
    role: "admin",
    createdAt: new Date().toISOString(),
  };
}

function categoryDoc() {
  const suffix = randomBytes(4).toString("hex");
  const now = new Date();
  return {
    _id: new ObjectId(),
    name: `Fail Closed Category ${suffix}`,
    slug: `fail-closed-category-${suffix}`,
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
    name: `Fail Closed Product ${suffix}`,
    slug: `fail-closed-product-${suffix}`,
    sku: `CLOSED-${suffix}`,
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
    name: "Fail Closed Created Product",
    slug: `fail-closed-created-${randomBytes(4).toString("hex")}`,
    sku: `CLOSED-CREATED-${randomBytes(4).toString("hex")}`,
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

async function clearCatalog() {
  await Promise.all(
    ["products", "categories", "inventoryAdjustments"].map((name) =>
      db.collection(name).deleteMany({}),
    ),
  );
}

if (hasMongo) {
  await db.command({ ping: 1 });

  beforeEach(async () => {
    assertIsolatedDatabase(db.databaseName);
    await clearCatalog();
  });

  after(async () => {
    await dropTestDatabase(db, testDbName);
    await mongoClient.close();
  });
}

dbTest("transactions are disabled in this suite", () => {
  assert.equal(transactionSupport, false);
});

dbTest("adjustments fail closed when transactions are unavailable", async () => {
  const admin = testAdmin();
  const product = await insertProduct({ stock: 10 });

  await assert.rejects(
    inventory.adjustProductStock(product._id.toHexString(), admin, {
      expectedStock: 10,
      delta: 2,
      reason: "Must fail closed",
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, "TRANSACTIONS_UNAVAILABLE");
      return true;
    },
  );

  const raw = await collections.productsCollection.findOne({
    _id: product._id,
  });
  assert.equal(raw.stock, 10);
  assert.equal(
    await collections.inventoryAdjustmentsCollection.countDocuments({}),
    0,
  );
});

dbTest("initial stock creation fails closed when transactions are unavailable", async () => {
  const admin = testAdmin();
  const category = await insertCategory();

  await assert.rejects(
    products.createProduct(productPayload(category._id, { stock: 5 }), admin),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, "TRANSACTIONS_UNAVAILABLE");
      return true;
    },
  );

  assert.equal(await collections.productsCollection.countDocuments({}), 0);
  assert.equal(
    await collections.inventoryAdjustmentsCollection.countDocuments({}),
    0,
  );
});

dbTest("zero-stock creation can proceed without a transaction or audit", async () => {
  const admin = testAdmin();
  const category = await insertCategory();

  const created = await products.createProduct(
    productPayload(category._id, { stock: 0 }),
    admin,
  );

  assert.equal(created.stock, 0);
  assert.equal(await collections.productsCollection.countDocuments({}), 1);
  assert.equal(
    await collections.inventoryAdjustmentsCollection.countDocuments({}),
    0,
  );
});
