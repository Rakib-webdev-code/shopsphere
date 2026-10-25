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
let cart;
let products;

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  cart = await import("../src/lib/services/cart.ts");
  products = await import("../src/lib/services/products.ts");
}

function testUser(label = "cart") {
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
    name: `Cart Product ${suffix}`,
    slug: `cart-product-${suffix}`,
    sku: `CART-${suffix}`,
    summary: "Cart test product",
    description: "Cart test product",
    highlights: [],
    tags: [],
    priceInCents: 2500,
    compareAtPriceInCents: null,
    categoryId: new ObjectId(),
    images: [],
    stock: 20,
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

async function insertProduct(overrides) {
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

async function rawCart(userId) {
  return collections.cartsCollection.findOne({ userId });
}

if (hasMongo) {
  await db.command({ ping: 1 });

  beforeEach(async () => {
    assertIsolatedDatabase(db.databaseName);
    await Promise.all(
      ["orders", "products", "carts", "categories"].map((name) =>
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

dbTest("concurrent add/add for the same product keeps both additions", async () => {
  const user = testUser("same-product");
  const product = await insertProduct({ stock: 20 });

  await Promise.all([
    cart.addCartItem(user.id, { productId: product._id.toHexString(), quantity: 1 }),
    cart.addCartItem(user.id, { productId: product._id.toHexString(), quantity: 2 }),
  ]);

  const raw = await rawCart(user.id);
  assert.equal(raw.items.length, 1);
  assert.equal(raw.items[0].quantity, 3);
  assert.equal(raw.revision, 2);
});

dbTest("concurrent add/add for different products keeps both lines", async () => {
  const user = testUser("different-products");
  const [first, second] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 20 }),
  ]);

  await Promise.all([
    cart.addCartItem(user.id, { productId: first._id.toHexString(), quantity: 1 }),
    cart.addCartItem(user.id, { productId: second._id.toHexString(), quantity: 2 }),
  ]);

  const raw = await rawCart(user.id);
  const quantities = new Map(
    raw.items.map((item) => [item.productId.toHexString(), item.quantity]),
  );
  assert.equal(quantities.get(first._id.toHexString()), 1);
  assert.equal(quantities.get(second._id.toHexString()), 2);
  assert.equal(raw.revision, 2);
});

dbTest("concurrent first-time cart creation does not overwrite the winner", async () => {
  const user = testUser("first-create");
  const [first, second] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 20 }),
  ]);

  await Promise.all([
    cart.addCartItem(user.id, { productId: first._id.toHexString(), quantity: 1 }),
    cart.addCartItem(user.id, { productId: second._id.toHexString(), quantity: 1 }),
  ]);

  const carts = await collections.cartsCollection
    .find({ userId: user.id })
    .toArray();
  assert.equal(carts.length, 1);
  assert.equal(carts[0].items.length, 2);
});

dbTest("concurrent add and update do not lose either mutation", async () => {
  const user = testUser("add-update");
  const [first, second] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 20 }),
  ]);
  await setCart(user.id, [[first._id, 1]]);

  await Promise.all([
    cart.addCartItem(user.id, { productId: second._id.toHexString(), quantity: 1 }),
    cart.updateCartItem(user.id, first._id.toHexString(), { quantity: 4 }),
  ]);

  const raw = await rawCart(user.id);
  const quantities = new Map(
    raw.items.map((item) => [item.productId.toHexString(), item.quantity]),
  );
  assert.equal(quantities.get(first._id.toHexString()), 4);
  assert.equal(quantities.get(second._id.toHexString()), 1);
});

dbTest("concurrent update and remove do not lose either mutation", async () => {
  const user = testUser("update-remove");
  const [first, second] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 20 }),
  ]);
  await setCart(user.id, [
    [first._id, 1],
    [second._id, 1],
  ]);

  await Promise.all([
    cart.updateCartItem(user.id, first._id.toHexString(), { quantity: 3 }),
    cart.removeCartItem(user.id, second._id.toHexString()),
  ]);

  const raw = await rawCart(user.id);
  assert.equal(raw.items.length, 1);
  assert.equal(raw.items[0].productId.toHexString(), first._id.toHexString());
  assert.equal(raw.items[0].quantity, 3);
});

dbTest("adding to an existing line cannot exceed MAX_QUANTITY", async () => {
  const user = testUser("max-quantity");
  const product = await insertProduct({ stock: 200 });

  await cart.addCartItem(user.id, {
    productId: product._id.toHexString(),
    quantity: 98,
  });

  await assert.rejects(
    cart.addCartItem(user.id, {
      productId: product._id.toHexString(),
      quantity: 2,
    }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );

  const raw = await rawCart(user.id);
  assert.equal(raw.items[0].quantity, 98);
});

dbTest("revision conflict retries are bounded and return CART_CONFLICT", async () => {
  const user = testUser("retry-exhaustion");
  const product = await insertProduct({ stock: 20 });
  const original = collections.cartsCollection.findOneAndUpdate.bind(
    collections.cartsCollection,
  );

  collections.cartsCollection.findOneAndUpdate = async () => null;

  try {
    await assert.rejects(
      cart.addCartItem(user.id, {
        productId: product._id.toHexString(),
        quantity: 1,
      }),
      (error) => {
        assert.equal(error.status, 409);
        assert.equal(error.code, "CART_CONFLICT");
        return true;
      },
    );
  } finally {
    collections.cartsCollection.findOneAndUpdate = original;
  }
});

dbTest("missing product lines are cleaned with a revision-guarded update", async () => {
  const user = testUser("orphan");
  const present = await insertProduct({ stock: 20 });
  const missingId = new ObjectId();
  await setCart(user.id, [
    [present._id, 1],
    [missingId, 2],
  ]);

  const result = await cart.getCartForUser(user.id);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productId, present._id.toHexString());
  const raw = await rawCart(user.id);
  assert.equal(raw.items.length, 1);
  assert.equal(raw.items[0].productId.toHexString(), present._id.toHexString());
  assert.equal(raw.revision, 1);
});

dbTest("inactive products stay visible and are flagged unavailable", async () => {
  const user = testUser("inactive");
  const product = await insertProduct({ active: false, stock: 20 });
  await setCart(user.id, [[product._id, 1]]);

  const result = await cart.getCartForUser(user.id);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].active, false);
  assert.equal(result.hasUnavailableItems, true);
});

dbTest("quantities outside 1..MAX_QUANTITY are flagged unavailable", async () => {
  const user = testUser("invalid-quantity");
  const [zero, tooMany] = await Promise.all([
    insertProduct({ stock: 20 }),
    insertProduct({ stock: 200 }),
  ]);
  await setCart(user.id, [
    [zero._id, 0],
    [tooMany._id, 100],
  ]);

  const result = await cart.getCartForUser(user.id);

  assert.equal(result.items.length, 2);
  assert.equal(result.hasUnavailableItems, true);
});

dbTest("inactive products cannot be added to a cart", async () => {
  const user = testUser("inactive-add");
  const product = await insertProduct({ active: false, stock: 20 });

  await assert.rejects(
    cart.addCartItem(user.id, {
      productId: product._id.toHexString(),
      quantity: 1,
    }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );
});

dbTest("product lookup still exposes an individually inactive product to admins", async () => {
  const product = await insertProduct({ active: false, stock: 20 });
  const publicProduct = await products.getProductById(product._id.toHexString());
  const adminProduct = await products.getProductById(product._id.toHexString(), {
    includeInactive: true,
  });

  assert.equal(publicProduct, null);
  assert.equal(adminProduct?.id, product._id.toHexString());
});
