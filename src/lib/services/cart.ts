import type { ObjectId } from "mongodb";
import { cartsCollection, productsCollection } from "@/lib/db/collections";
import type { CartDoc, CartItemDoc, ProductDoc } from "@/lib/db/types";
import { conflict, notFound, ValidationError } from "@/lib/errors";
import { MAX_QUANTITY } from "@/lib/constants";
import type { Cart, CartItem } from "@/lib/types";
import {
  asRecord,
  parseObjectId,
  readInt,
} from "@/lib/validation";

function emptyCart(): Cart {
  return {
    items: [],
    itemCount: 0,
    subtotalCents: 0,
    hasUnavailableItems: false,
    updatedAt: null,
  };
}

async function serializeCart(cart: CartDoc | null): Promise<Cart> {
  if (!cart || cart.items.length === 0) {
    return emptyCart();
  }

  const productIds = cart.items.map((item) => item.productId);
  const products = await productsCollection
    .find({ _id: { $in: productIds } })
    .toArray();
  const productMap = new Map(
    products.map((product) => [product._id.toHexString(), product]),
  );

  const items: CartItem[] = [];

  for (const item of cart.items) {
    const product = productMap.get(item.productId.toHexString());

    if (!product) {
      continue;
    }

    items.push({
      productId: product._id.toHexString(),
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      priceInCents: product.priceInCents,
      quantity: item.quantity,
      stock: product.stock,
      active: product.active,
      lineTotalCents: product.priceInCents * item.quantity,
    });
  }

  return {
    items,
    itemCount: items.reduce((total, item) => total + item.quantity, 0),
    subtotalCents: items.reduce(
      (total, item) => total + item.lineTotalCents,
      0,
    ),
    hasUnavailableItems: items.some(
      (item) => !item.active || item.stock < item.quantity,
    ),
    updatedAt: cart.updatedAt.toISOString(),
  };
}

export async function getCartForUser(userId: string): Promise<Cart> {
  const cart = await cartsCollection.findOne({ userId });
  return serializeCart(cart);
}

async function findActiveProduct(productId: ObjectId) {
  const product = await productsCollection.findOne({ _id: productId });

  if (!product) {
    throw notFound("Product not found.");
  }

  if (!product.active) {
    throw conflict("This product is no longer available.");
  }

  return product;
}

function readQuantity(value: unknown, allowZero = false): number {
  return readInt(value, {
    label: "Quantity",
    min: allowZero ? 0 : 1,
    max: MAX_QUANTITY,
  });
}

export async function addCartItem(
  userId: string,
  raw: unknown,
): Promise<Cart> {
  const body = asRecord(raw);
  const productId = parseObjectId(body.productId, "Product");
  const quantity = readQuantity(body.quantity);
  const product = await findActiveProduct(productId);
  const cart = await cartsCollection.findOne({ userId });
  const items = cart?.items ? [...cart.items] : [];
  const existingIndex = items.findIndex((item) =>
    item.productId.equals(productId),
  );
  const existingQuantity =
    existingIndex >= 0 ? items[existingIndex].quantity : 0;
  const nextQuantity = existingQuantity + quantity;

  assertStock(product, nextQuantity);

  if (existingIndex >= 0) {
    items[existingIndex] = {
      ...items[existingIndex],
      quantity: nextQuantity,
    };
  } else {
    items.push({
      productId,
      quantity,
      addedAt: new Date(),
    });
  }

  return saveCart(userId, items);
}

export async function updateCartItem(
  userId: string,
  productIdValue: string,
  raw: unknown,
): Promise<Cart> {
  const productId = parseObjectId(productIdValue, "Product");
  const body = asRecord(raw);
  const quantity = readQuantity(body.quantity, true);
  const cart = await cartsCollection.findOne({ userId });

  if (!cart) {
    throw notFound("Your cart is empty.");
  }

  const existing = cart.items.find((item) =>
    item.productId.equals(productId),
  );

  if (!existing) {
    throw notFound("That product is not in your cart.");
  }

  if (quantity === 0) {
    return saveCart(
      userId,
      cart.items.filter((item) => !item.productId.equals(productId)),
    );
  }

  const product = await findActiveProduct(productId);
  assertStock(product, quantity);

  const items = cart.items.map((item) =>
    item.productId.equals(productId) ? { ...item, quantity } : item,
  );

  return saveCart(userId, items);
}

export async function removeCartItem(
  userId: string,
  productIdValue: string,
): Promise<Cart> {
  const productId = parseObjectId(productIdValue, "Product");
  const cart = await cartsCollection.findOne({ userId });

  if (!cart) {
    return emptyCart();
  }

  return saveCart(
    userId,
    cart.items.filter((item) => !item.productId.equals(productId)),
  );
}

function assertStock(product: ProductDoc, quantity: number) {
  if (product.stock < quantity) {
    throw new ValidationError(
      product.stock === 0
        ? "This product is out of stock."
        : `Only ${product.stock} left in stock.`,
    );
  }
}

async function saveCart(
  userId: string,
  items: CartItemDoc[],
): Promise<Cart> {
  const now = new Date();

  await cartsCollection.updateOne(
    { userId },
    {
      $set: { items, updatedAt: now },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true },
  );

  const updated = await cartsCollection.findOne({ userId });
  return serializeCart(updated);
}

export async function clearCart(userId: string) {
  await cartsCollection.updateOne(
    { userId },
    { $set: { items: [], updatedAt: new Date() } },
  );
}

export async function getCartDocument(userId: string) {
  return cartsCollection.findOne({ userId });
}
