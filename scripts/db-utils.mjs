import { MongoClient } from "mongodb";

export function getDatabase() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env before running this script.");
  }

  const client = new MongoClient(uri);
  const db = client.db(process.env.MONGODB_DB ?? "shopsphere");

  return { client, db };
}

export async function ensureIndexes(db) {
  await Promise.all([
    db.collection("categories").createIndexes([
      { key: { slug: 1 }, name: "categories_slug_uidx", unique: true },
      { key: { active: 1, name: 1 }, name: "categories_active_name_idx" },
    ]),
    db.collection("products").createIndexes([
      { key: { slug: 1 }, name: "products_slug_uidx", unique: true },
      { key: { sku: 1 }, name: "products_sku_uidx", unique: true, sparse: true },
      {
        key: { active: 1, categoryId: 1, priceInCents: 1 },
        name: "products_active_category_price_idx",
      },
      {
        key: { active: 1, featured: -1, createdAt: -1 },
        name: "products_active_featured_created_idx",
      },
      {
        key: { active: 1, priceInCents: 1 },
        name: "products_active_price_idx",
      },
      {
        key: { active: 1, ratingAverage: -1 },
        name: "products_active_rating_idx",
      },
      { key: { stock: 1, active: 1 }, name: "products_stock_active_idx" },
      {
        key: { active: 1, stock: 1 },
        name: "products_active_stock_idx",
      },
    ]),
    db.collection("carts").createIndexes([
      { key: { userId: 1 }, name: "carts_user_uidx", unique: true },
    ]),
    db.collection("wishlists").createIndexes([
      { key: { userId: 1 }, name: "wishlists_user_uidx", unique: true },
    ]),
    db.collection("addresses").createIndexes([
      {
        key: { userId: 1, isDefault: -1, createdAt: -1 },
        name: "addresses_user_default_idx",
      },
    ]),
    db.collection("orders").createIndexes([
      { key: { orderNumber: 1 }, name: "orders_number_uidx", unique: true },
      {
        key: { userId: 1, createdAt: -1 },
        name: "orders_user_created_idx",
      },
      {
        key: { status: 1, createdAt: -1 },
        name: "orders_status_created_idx",
      },
      { key: { createdAt: -1 }, name: "orders_created_idx" },
      {
        key: { userId: 1, checkoutKey: 1 },
        name: "orders_user_checkout_key_uidx",
        unique: true,
        partialFilterExpression: { checkoutKey: { $type: "string" } },
      },
    ]),
    db.collection("reviews").createIndexes([
      {
        key: { productId: 1, userId: 1 },
        name: "reviews_product_user_uidx",
        unique: true,
      },
      {
        key: { productId: 1, createdAt: -1 },
        name: "reviews_product_created_idx",
      },
      {
        key: { userId: 1, createdAt: -1 },
        name: "reviews_user_created_idx",
      },
    ]),
    db.collection("coupons").createIndexes([
      { key: { code: 1 }, name: "coupons_code_uidx", unique: true },
      {
        key: { active: 1, expiresAt: 1 },
        name: "coupons_active_expiry_idx",
      },
    ]),
    db.collection("user").createIndexes([
      { key: { role: 1 }, name: "user_role_idx" },
    ]),
  ]);
}

export function printDatabaseName(db) {
  console.log(`Connected to MongoDB database "${db.databaseName}".`);
}
