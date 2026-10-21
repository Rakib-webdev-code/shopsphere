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
let transactionSupport = false;
const dbTest = hasMongo ? test : test.skip;

let db;
let mongoClient;
let collections;
let orders;

const SHIPPING = {
  fullName: "Transaction Test Buyer",
  line1: "1 Test Street",
  line2: "",
  city: "Testville",
  state: "Test State",
  postalCode: "12345",
  country: "Testland",
  phone: "",
};

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  orders = await import("../src/lib/services/orders.ts");
  const transactions = await import("../src/lib/db/transactions.ts");
  transactionSupport = await transactions.supportsTransactions();
}

const txnTest = transactionSupport ? dbTest : test.skip;

function key() {
  return `txn-${randomBytes(12).toString("hex")}`;
}

function user() {
  return {
    id: `txn-user-${randomBytes(4).toString("hex")}`,
    name: "Transaction Buyer",
    email: `txn-${randomBytes(4).toString("hex")}@example.test`,
    emailVerified: true,
    image: null,
    phone: null,
    role: "customer",
    createdAt: new Date().toISOString(),
  };
}

async function seedProduct(stock = 10) {
  const now = new Date();
  const suffix = randomBytes(5).toString("hex");
  const product = {
    _id: new ObjectId(),
    name: `Transaction Product ${suffix}`,
    slug: `transaction-product-${suffix}`,
    sku: `TXN-${suffix}`,
    summary: "",
    description: "",
    highlights: [],
    tags: [],
    priceInCents: 2500,
    compareAtPriceInCents: null,
    categoryId: new ObjectId(),
    images: [],
    stock,
    badge: null,
    featured: false,
    active: true,
    ratingAverage: 0,
    ratingCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await collections.productsCollection.insertOne(product);
  return product;
}

async function seedCoupon() {
  const now = new Date();
  const coupon = {
    _id: new ObjectId(),
    code: `TXN${randomBytes(4).toString("hex").toUpperCase()}`,
    description: "Transaction test coupon",
    type: "percentage",
    value: 10,
    minSubtotalCents: 0,
    maxUses: 5,
    usedCount: 0,
    expiresAt: null,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await collections.couponsCollection.insertOne(coupon);
  return coupon;
}

async function seedCart(userId, productId, quantity) {
  const now = new Date();
  await collections.cartsCollection.insertOne({
    _id: new ObjectId(),
    userId,
    items: [{ productId, quantity, addedAt: now }],
    createdAt: now,
    updatedAt: now,
  });
}

if (hasMongo) {
  beforeEach(async () => {
    assertIsolatedDatabase(db.databaseName);
    await Promise.all(
      ["orders", "products", "carts", "coupons"].map((name) =>
        db.collection(name).deleteMany({}),
      ),
    );
    await collections.ensureCatalogIndexes();
  });

  after(async () => {
    await dropTestDatabase(db);
    await mongoClient.close();
  });
}

txnTest("transactional checkout reserves stock and coupon atomically", async () => {
  const buyer = user();
  const product = await seedProduct(10);
  const coupon = await seedCoupon();
  await seedCart(buyer.id, product._id, 2);

  const order = await orders.createOrder(buyer, {
    shipping: SHIPPING,
    couponCode: coupon.code,
    checkoutKey: key(),
  });

  assert.equal(order.status, "pending");
  assert.equal(order.paymentStatus, "unpaid");
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 8);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 1);
  assert.deepEqual(
    (await collections.cartsCollection.findOne({ userId: buyer.id })).items,
    [],
  );

  const cancelled = await orders.updateOrderStatus(order.id, "cancelled");
  assert.equal(cancelled.inventoryState, "released");
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 10);
  assert.equal((await collections.couponsCollection.findOne({ _id: coupon._id })).usedCount, 0);
});

txnTest("transactional checkout is idempotent for a repeated checkout key", async () => {
  const buyer = user();
  const product = await seedProduct(10);
  await seedCart(buyer.id, product._id, 2);
  const checkoutKey = key();

  const first = await orders.createOrder(buyer, {
    shipping: SHIPPING,
    checkoutKey,
  });
  const second = await orders.createOrder(buyer, {
    shipping: SHIPPING,
    checkoutKey,
  });

  assert.equal(second.id, first.id);
  assert.equal(await collections.ordersCollection.countDocuments({}), 1);
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 8);
});
