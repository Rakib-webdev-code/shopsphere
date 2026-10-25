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
let cart;

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
  cart = await import("../src/lib/services/cart.ts");
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
    await dropTestDatabase(db, testDbName);
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

txnTest("transactional checkout aborts when the cart changes mid-checkout", async () => {
  const buyer = user();
  const [purchased, added] = await Promise.all([seedProduct(10), seedProduct(10)]);
  await seedCart(buyer.id, purchased._id, 1);
  const originalInsert = collections.ordersCollection.insertOne.bind(
    collections.ordersCollection,
  );
  let triggered = false;

  collections.ordersCollection.insertOne = async (document, options) => {
    if (!triggered) {
      triggered = true;
      await cart.addCartItem(buyer.id, {
        productId: added._id.toHexString(),
        quantity: 1,
      });
    }

    return originalInsert(document, options);
  };

  try {
    await assert.rejects(
      orders.createOrder(buyer, { shipping: SHIPPING, checkoutKey: key() }),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      },
    );
  } finally {
    collections.ordersCollection.insertOne = originalInsert;
  }

  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  assert.equal(
    (await collections.productsCollection.findOne({ _id: purchased._id })).stock,
    10,
  );
  assert.equal(
    (await collections.productsCollection.findOne({ _id: added._id })).stock,
    10,
  );
  const rawCart = await collections.cartsCollection.findOne({
    userId: buyer.id,
  });
  const quantities = new Map(
    rawCart.items.map((item) => [item.productId.toHexString(), item.quantity]),
  );
  assert.equal(quantities.get(purchased._id.toHexString()), 1);
  assert.equal(quantities.get(added._id.toHexString()), 1);
});
