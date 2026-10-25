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
  fullName: "Catalog Test Buyer",
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
let products;
let categories;

if (hasMongo) {
  const mongodb = await import("../src/lib/mongodb.ts");
  db = mongodb.db;
  mongoClient = mongodb.mongoClient;
  assertIsolatedDatabase(db.databaseName);
  assert.equal(db.databaseName, testDbName);
  collections = await import("../src/lib/db/collections.ts");
  orders = await import("../src/lib/services/orders.ts");
  products = await import("../src/lib/services/products.ts");
  categories = await import("../src/lib/services/categories.ts");
}

function testUser(label = "catalog") {
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

function adminUser() {
  return { ...testUser("admin"), role: "admin" };
}

function categoryDoc(overrides = {}) {
  const now = new Date();
  const suffix = randomBytes(5).toString("hex");
  return {
    _id: new ObjectId(),
    name: `Test Category ${suffix}`,
    slug: `test-category-${suffix}`,
    tagline: "Test category",
    description: "Test category",
    icon: "sparkles",
    imageUrl: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function productDoc(categoryId, overrides = {}) {
  const now = new Date();
  const suffix = randomBytes(5).toString("hex");
  return {
    _id: new ObjectId(),
    name: `Catalog Product ${suffix}`,
    slug: `catalog-product-${suffix}`,
    sku: `CAT-${suffix}`,
    summary: "Catalog test product",
    description: "Catalog test product",
    highlights: [],
    tags: [],
    priceInCents: 2500,
    compareAtPriceInCents: null,
    categoryId,
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

function productPayload(categoryId, overrides = {}) {
  const suffix = randomBytes(5).toString("hex");
  return {
    name: `Created Product ${suffix}`,
    slug: `created-product-${suffix}`,
    sku: `CREATED-${suffix}`,
    summary: "Created test product",
    description: "Created test product",
    highlights: [],
    tags: [],
    priceInCents: 2500,
    compareAtPriceInCents: null,
    categoryId: categoryId.toHexString(),
    images: [],
    stock: 0,
    badge: null,
    featured: false,
    ...overrides,
  };
}

async function insertCategory(overrides) {
  const category = categoryDoc(overrides);
  await collections.categoriesCollection.insertOne(category);
  return category;
}

async function insertProduct(categoryId, overrides) {
  const product = productDoc(categoryId, overrides);
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

function pauseCheckoutBeforeStockReservation(productId) {
  let notifyEntered;
  let resumeCheckout;
  const entered = new Promise((resolve) => {
    notifyEntered = resolve;
  });
  const paused = new Promise((resolve) => {
    resumeCheckout = resolve;
  });
  const originalUpdateOne = collections.productsCollection.updateOne.bind(
    collections.productsCollection,
  );
  let shouldPause = true;

  collections.productsCollection.updateOne = async (filter, update, options) => {
    if (shouldPause && filter?._id?.equals(productId) && update?.$inc?.stock < 0) {
      shouldPause = false;
      notifyEntered();
      await paused;
    }

    return originalUpdateOne(filter, update, options);
  };

  return {
    entered,
    resume() {
      resumeCheckout();
    },
    restore() {
      resumeCheckout();
      collections.productsCollection.updateOne = originalUpdateOne;
    },
  };
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

dbTest("category deactivation makes its products unavailable for browsing and checkout without destroying product active state", async () => {
  const user = testUser("category-deactivate");
  const category = await insertCategory();
  const product = await insertProduct(category._id, { stock: 5 });
  await setCart(user.id, [[product._id, 1]]);

  await categories.setCategoryActive(category._id.toHexString(), false);

  const rawProduct = await collections.productsCollection.findOne({
    _id: product._id,
  });
  // Product preserves its individual active status in the database
  assert.equal(rawProduct.active, true);
  // But storefront guards hide it because the category is inactive
  assert.equal(
    await products.getProductBySlug(product.slug),
    null,
  );
  const list = await products.listProducts({ category: category.slug });
  assert.equal(list.total, 0);
  const generalList = await products.listProducts({ q: product.name });
  assert.equal(generalList.total, 0);

  await assert.rejects(
    orders.createOrder(user, { shipping: SHIPPING, checkoutKey: `category-${randomBytes(12).toString("hex")}` }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );

  assert.equal(
    (await collections.productsCollection.findOne({ _id: product._id })).stock,
    5,
  );
  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  const cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.equal(cart.items[0].quantity, 1);
});

dbTest("category deactivation cannot pass an in-flight checkout eligibility lock", async () => {
  const user = testUser("category-race");
  const category = await insertCategory();
  const product = await insertProduct(category._id, { stock: 5 });
  await setCart(user.id, [[product._id, 1]]);

  let notifyEntered;
  let resumeCheckout;
  const entered = new Promise((resolve) => {
    notifyEntered = resolve;
  });
  const paused = new Promise((resolve) => {
    resumeCheckout = resolve;
  });
  const originalUpdateOne = collections.productsCollection.updateOne.bind(
    collections.productsCollection,
  );
  let shouldPause = true;
  collections.productsCollection.updateOne = async (filter, update, options) => {
    if (shouldPause && filter?._id?.equals(product._id) && update?.$inc?.stock < 0) {
      shouldPause = false;
      notifyEntered();
      await paused;
    }

    return originalUpdateOne(filter, update, options);
  };

  const checkout = orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `category-race-${randomBytes(12).toString("hex")}`,
  });

  try {
    await entered;
    await assert.rejects(
      categories.setCategoryActive(category._id.toHexString(), false),
      (error) => {
        assert.equal(error.status, 409);
        return true;
      },
    );

    resumeCheckout();
    const order = await checkout;
    assert.equal(order.inventoryState, "reserved");
    await categories.setCategoryActive(category._id.toHexString(), false);
    assert.equal(
      (await collections.categoriesCollection.findOne({ _id: category._id })).active,
      false,
    );
  } finally {
    resumeCheckout();
    collections.productsCollection.updateOne = originalUpdateOne;
  }
});

dbTest("checkout aborts and releases stock when the product is reassigned before reservation", async () => {
  const user = testUser("checkout-reassignment-race");
  const originalCategory = await insertCategory();
  const newCategory = await insertCategory();
  const product = await insertProduct(originalCategory._id, { stock: 5 });
  await setCart(user.id, [[product._id, 1]]);
  const pause = pauseCheckoutBeforeStockReservation(product._id);
  const checkout = orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `reassignment-race-${randomBytes(12).toString("hex")}`,
  });

  try {
    await pause.entered;
    await products.updateProduct(product._id.toHexString(), {
      categoryId: newCategory._id.toHexString(),
    });
    pause.resume();

    await assert.rejects(checkout, (error) => {
      assert.equal(error.status, 409);
      return true;
    });
  } finally {
    pause.restore();
  }

  const order = await collections.ordersCollection.findOne({ userId: user.id });
  assert.equal(order.inventoryState, "released");
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 5);
  assert.equal((await collections.cartsCollection.findOne({ userId: user.id })).items[0].quantity, 1);
  for (const category of [originalCategory, newCategory]) {
    const current = await collections.categoriesCollection.findOne({ _id: category._id });
    assert.equal(
      current.checkoutReservations?.some((entry) => entry.orderId.equals(order._id)) ?? false,
      false,
    );
  }
});

dbTest("checkout aborts if the reassigned category is deactivated before reservation", async () => {
  const user = testUser("checkout-new-category-deactivated");
  const originalCategory = await insertCategory();
  const newCategory = await insertCategory();
  const product = await insertProduct(originalCategory._id, { stock: 5 });
  await setCart(user.id, [[product._id, 1]]);
  const pause = pauseCheckoutBeforeStockReservation(product._id);
  const checkout = orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `new-category-deactivated-${randomBytes(12).toString("hex")}`,
  });

  try {
    await pause.entered;
    await products.updateProduct(product._id.toHexString(), {
      categoryId: newCategory._id.toHexString(),
    });
    await categories.setCategoryActive(newCategory._id.toHexString(), false);
    pause.resume();

    await assert.rejects(checkout, (error) => {
      assert.equal(error.status, 409);
      return true;
    });
  } finally {
    pause.restore();
  }

  const order = await collections.ordersCollection.findOne({ userId: user.id });
  assert.equal(order.inventoryState, "released");
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 5);
  assert.equal((await collections.cartsCollection.findOne({ userId: user.id })).items[0].quantity, 1);
  assert.equal(
    (await collections.categoriesCollection.findOne({ _id: originalCategory._id }))
      .checkoutReservations?.some((entry) => entry.orderId.equals(order._id)) ?? false,
    false,
  );
});

dbTest("checkout reserves a product whose active category remains unchanged", async () => {
  const user = testUser("checkout-category-unchanged");
  const category = await insertCategory();
  const product = await insertProduct(category._id, { stock: 5 });
  await setCart(user.id, [[product._id, 1]]);

  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `unchanged-category-${randomBytes(12).toString("hex")}`,
  });

  assert.equal(order.inventoryState, "reserved");
  assert.equal((await collections.productsCollection.findOne({ _id: product._id })).stock, 4);
  assert.equal(
    (await collections.categoriesCollection.findOne({ _id: category._id })).active,
    true,
  );
});

dbTest("category reactivation restores active products while leaving individually inactive products inactive", async () => {
  const category = await insertCategory();
  const activeProduct = await insertProduct(category._id, { active: true });
  const inactiveProduct = await insertProduct(category._id, {
    active: false,
  });

  await categories.setCategoryActive(category._id.toHexString(), false);
  // Products preserve individual active settings while category is deactivated
  assert.equal(
    (await collections.productsCollection.findOne({ _id: activeProduct._id }))
      .active,
    true,
  );
  assert.equal(
    (await collections.productsCollection.findOne({ _id: inactiveProduct._id }))
      .active,
    false,
  );
  // Storefront hides both while category is deactivated
  assert.equal(await products.getProductBySlug(activeProduct.slug), null);
  assert.equal(await products.getProductBySlug(inactiveProduct.slug), null);

  await categories.setCategoryActive(category._id.toHexString(), true);

  // Active product is restored to storefront browsing
  assert.equal(
    (await collections.productsCollection.findOne({ _id: activeProduct._id }))
      .active,
    true,
  );
  const restored = await products.getProductBySlug(activeProduct.slug);
  assert.notEqual(restored, null);
  assert.equal(restored.slug, activeProduct.slug);

  // Individually inactive product remains inactive and hidden
  assert.equal(
    (await collections.productsCollection.findOne({ _id: inactiveProduct._id }))
      .active,
    false,
  );
  assert.equal(await products.getProductBySlug(inactiveProduct.slug), null);
});

dbTest("an active product cannot be created in an inactive category", async () => {
  const category = await insertCategory({ active: false });

  await assert.rejects(
    products.createProduct(productPayload(category._id), adminUser()),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );

  const created = await products.createProduct(
    productPayload(category._id, { active: false }),
    adminUser(),
  );
  assert.equal(created.active, false);
});

dbTest("an active product cannot be moved into an inactive category", async () => {
  const activeCategory = await insertCategory();
  const inactiveCategory = await insertCategory({ active: false });
  const product = await insertProduct(activeCategory._id, { active: true });

  await assert.rejects(
    products.updateProduct(product._id.toHexString(), {
      categoryId: inactiveCategory._id.toHexString(),
    }),
    (error) => {
      assert.equal(error.status, 400);
      return true;
    },
  );

  const moved = await products.updateProduct(product._id.toHexString(), {
    categoryId: inactiveCategory._id.toHexString(),
    active: false,
  });
  assert.equal(moved.category?.id, inactiveCategory._id.toHexString());
  assert.equal(moved.active, false);
});

dbTest("database price and stock remain authoritative for checkout", async () => {
  const user = testUser("authoritative");
  const category = await insertCategory();
  const product = await insertProduct(category._id, {
    priceInCents: 2500,
    stock: 5,
  });
  await setCart(user.id, [[product._id, 2]]);

  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `authoritative-${randomBytes(12).toString("hex")}`,
    priceInCents: 1,
    totalCents: 1,
    items: [{ productId: product._id.toHexString(), quantity: 99, priceInCents: 1 }],
  });

  assert.equal(order.items[0].priceInCents, 2500);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].lineTotalCents, 5000);
  assert.equal(order.subtotalCents, 5000);
  assert.equal(
    (await collections.productsCollection.findOne({ _id: product._id })).stock,
    3,
  );
});

dbTest("insufficient stock leaves the cart intact and creates no order", async () => {
  const user = testUser("insufficient");
  const category = await insertCategory();
  const product = await insertProduct(category._id, { stock: 2 });
  await setCart(user.id, [[product._id, 3]]);

  await assert.rejects(
    orders.createOrder(user, { shipping: SHIPPING, checkoutKey: `stock-${randomBytes(12).toString("hex")}` }),
    (error) => {
      assert.equal(error.status, 409);
      return true;
    },
  );

  assert.equal(await collections.ordersCollection.countDocuments({}), 0);
  assert.equal(
    (await collections.productsCollection.findOne({ _id: product._id })).stock,
    2,
  );
  const cart = await collections.cartsCollection.findOne({ userId: user.id });
  assert.equal(cart.items[0].quantity, 3);
});

dbTest("historical order snapshots survive price, slug, and active changes", async () => {
  const user = testUser("historical");
  const category = await insertCategory();
  const product = await insertProduct(category._id, {
    priceInCents: 2500,
    stock: 10,
  });
  await setCart(user.id, [[product._id, 2]]);

  const order = await orders.createOrder(user, {
    shipping: SHIPPING,
    checkoutKey: `historical-${randomBytes(12).toString("hex")}`,
  });
  const originalItem = order.items[0];
  const originalSlug = product.slug;

  const updated = await products.updateProduct(product._id.toHexString(), {
    priceInCents: 9900,
    slug: "historical-product-new-slug",
  });
  assert.equal(updated.slug, "historical-product-new-slug");

  const afterPriceChange = await orders.getOrderForUser(user.id, order.id);
  assert.equal(afterPriceChange.items[0].name, originalItem.name);
  assert.equal(afterPriceChange.items[0].slug, originalSlug);
  assert.equal(afterPriceChange.items[0].priceInCents, 2500);
  assert.equal(afterPriceChange.items[0].quantity, 2);
  assert.equal(afterPriceChange.items[0].lineTotalCents, 5000);
  assert.equal(afterPriceChange.subtotalCents, 5000);

  const linksAfterSlugChange = await products.getActiveProductLinks([
    product._id.toHexString(),
  ]);
  assert.equal(
    linksAfterSlugChange.get(product._id.toHexString()),
    "/shop/historical-product-new-slug",
  );

  await products.setProductActive(product._id.toHexString(), false);

  const afterDeactivation = await orders.getOrderForUser(user.id, order.id);
  assert.deepEqual(afterDeactivation.items, afterPriceChange.items);
  assert.equal(afterDeactivation.subtotalCents, 5000);
  assert.equal(
    (await products.getActiveProductLinks([product._id.toHexString()])).size,
    0,
  );
});
