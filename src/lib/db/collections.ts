import type { Collection } from "mongodb";
import { db } from "@/lib/mongodb";
import type {
  AddressDoc,
  CartDoc,
  CategoryDoc,
  CouponDoc,
  OrderDoc,
  ProductDoc,
  ReviewDoc,
  UserDoc,
  WishlistDoc,
} from "@/lib/db/types";

export const usersCollection: Collection<UserDoc> =
  db.collection<UserDoc>("user");
export const categoriesCollection: Collection<CategoryDoc> =
  db.collection<CategoryDoc>("categories");
export const productsCollection: Collection<ProductDoc> =
  db.collection<ProductDoc>("products");
export const cartsCollection: Collection<CartDoc> =
  db.collection<CartDoc>("carts");
export const wishlistsCollection: Collection<WishlistDoc> =
  db.collection<WishlistDoc>("wishlists");
export const addressesCollection: Collection<AddressDoc> =
  db.collection<AddressDoc>("addresses");
export const ordersCollection: Collection<OrderDoc> =
  db.collection<OrderDoc>("orders");
export const reviewsCollection: Collection<ReviewDoc> =
  db.collection<ReviewDoc>("reviews");
export const couponsCollection: Collection<CouponDoc> =
  db.collection<CouponDoc>("coupons");

/**
 * Called by the explicit `npm run db:init` script (and the seed script).
 * It is intentionally not called during application startup.
 */
export async function ensureCatalogIndexes() {
  await Promise.all([
    categoriesCollection.createIndexes([
      { key: { slug: 1 }, name: "categories_slug_uidx", unique: true },
      { key: { active: 1, name: 1 }, name: "categories_active_name_idx" },
    ]),
    productsCollection.createIndexes([
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
    cartsCollection.createIndexes([
      { key: { userId: 1 }, name: "carts_user_uidx", unique: true },
    ]),
    wishlistsCollection.createIndexes([
      { key: { userId: 1 }, name: "wishlists_user_uidx", unique: true },
    ]),
    addressesCollection.createIndexes([
      {
        key: { userId: 1, isDefault: -1, createdAt: -1 },
        name: "addresses_user_default_idx",
      },
    ]),
    ordersCollection.createIndexes([
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
    reviewsCollection.createIndexes([
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
    couponsCollection.createIndexes([
      { key: { code: 1 }, name: "coupons_code_uidx", unique: true },
      {
        key: { active: 1, expiresAt: 1 },
        name: "coupons_active_expiry_idx",
      },
    ]),
    usersCollection.createIndexes([
      { key: { role: 1 }, name: "user_role_idx" },
    ]),
  ]);
}
