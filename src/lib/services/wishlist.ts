import {
  categoriesCollection,
  productsCollection,
  wishlistsCollection,
} from "@/lib/db/collections";
import { conflict, notFound } from "@/lib/errors";
import type { Wishlist } from "@/lib/types";
import { serializeProducts } from "@/lib/services/products";
import { asRecord, parseObjectId } from "@/lib/validation";

export async function getWishlistForUser(userId: string): Promise<Wishlist> {
  const wishlist = await wishlistsCollection.findOne({ userId });

  if (!wishlist || wishlist.productIds.length === 0) {
    return { products: [] };
  }

  const products = await productsCollection
    .find({
      _id: { $in: wishlist.productIds },
      active: true,
    })
    .toArray();
  const productMap = new Map(
    products.map((product) => [product._id.toHexString(), product]),
  );
  const inactiveCategories =
    products.length === 0
      ? []
      : await categoriesCollection
          .find(
            {
              _id: { $in: products.map((product) => product.categoryId) },
              active: false,
            },
            { projection: { _id: 1 } },
          )
          .toArray();
  const inactiveCategoryIds = new Set(
    inactiveCategories.map((category) => category._id.toHexString()),
  );
  const ordered = wishlist.productIds
    .map((id) => productMap.get(id.toHexString()))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .filter(
      (product) => !inactiveCategoryIds.has(product.categoryId.toHexString()),
    );

  return { products: await serializeProducts(ordered) };
}

export async function addToWishlist(
  userId: string,
  raw: unknown,
): Promise<Wishlist> {
  const body = asRecord(raw);
  const productId = parseObjectId(body.productId, "Product");
  const product = await productsCollection.findOne({
    _id: productId,
    active: true,
  });

  if (!product) {
    throw notFound("Product not found.");
  }

  const category = await categoriesCollection.findOne(
    { _id: product.categoryId },
    { projection: { active: 1 } },
  );

  if (category && !category.active) {
    throw conflict("This product category is no longer available.");
  }

  const now = new Date();

  await wishlistsCollection.updateOne(
    { userId },
    {
      $addToSet: { productIds: productId },
      $set: { updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  return getWishlistForUser(userId);
}

export async function removeFromWishlist(
  userId: string,
  productIdValue: string,
): Promise<Wishlist> {
  const productId = parseObjectId(productIdValue, "Product");
  const wishlist = await wishlistsCollection.findOne({ userId });

  if (!wishlist) {
    return { products: [] };
  }

  if (!wishlist.productIds.some((id) => id.equals(productId))) {
    throw conflict("That product is not in your wishlist.");
  }

  await wishlistsCollection.updateOne(
    { userId },
    {
      $pull: { productIds: productId },
      $set: { updatedAt: new Date() },
    },
  );

  return getWishlistForUser(userId);
}
