import { MongoServerError, type Filter, type ObjectId } from "mongodb";
import {
  cartsCollection,
  categoriesCollection,
  productsCollection,
} from "@/lib/db/collections";
import type { CartDoc, CartItemDoc, ProductDoc } from "@/lib/db/types";
import {
  ApiError,
  conflict,
  notFound,
  ValidationError,
} from "@/lib/errors";
import { MAX_QUANTITY } from "@/lib/constants";
import type { Cart, CartItem } from "@/lib/types";
import {
  asRecord,
  parseObjectId,
  readInt,
} from "@/lib/validation";

const CART_MUTATION_RETRIES = 5;
const CART_CONFLICT_MESSAGE =
  "Your cart changed while it was being updated. Refresh and try again.";

function emptyCart(): Cart {
  return {
    items: [],
    itemCount: 0,
    subtotalCents: 0,
    hasUnavailableItems: false,
    revision: 0,
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
  const categories = await categoriesCollection
    .find({ _id: { $in: products.map((product) => product.categoryId) } })
    .toArray();
  const categoryActive = new Map(
    categories.map((category) => [
      category._id.toHexString(),
      Boolean(category.active),
    ]),
  );

  const items: CartItem[] = [];

  for (const item of cart.items) {
    const product = productMap.get(item.productId.toHexString());

    if (!product) {
      // Missing products are removed by loadCartForUser before serialization.
      // Keep this defensive guard for callers that serialize a just-written cart.
      continue;
    }

    // A product is purchasable only when both it and its category are active.
    // Missing categories are treated leniently for historical data, matching
    // checkout's behaviour.
    const categoryIsActive =
      categoryActive.get(product.categoryId.toHexString()) ?? true;

    items.push({
      productId: product._id.toHexString(),
      slug: product.slug,
      name: product.name,
      image: product.images?.[0] ?? null,
      priceInCents: product.priceInCents,
      quantity: item.quantity,
      stock: product.stock,
      active: product.active && categoryIsActive,
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
      (item) =>
        !item.active ||
        item.quantity < 1 ||
        item.quantity > MAX_QUANTITY ||
        item.stock < item.quantity,
    ),
    revision: cart.revision ?? 0,
    updatedAt: cart.updatedAt.toISOString(),
  };
}

function revisionFilter(cart: CartDoc): Filter<CartDoc> {
  return cart.revision === undefined
    ? { revision: { $exists: false } }
    : { revision: cart.revision };
}

async function writeCartItems(
  userId: string,
  cart: CartDoc | null,
  items: CartItemDoc[],
): Promise<CartDoc | null> {
  const now = new Date();

  if (cart) {
    return cartsCollection.findOneAndUpdate(
      {
        _id: cart._id,
        userId,
        ...revisionFilter(cart),
      },
      {
        $set: { items, updatedAt: now },
        $inc: { revision: 1 },
      },
      { returnDocument: "after" },
    );
  }

  // The revision-missing filter makes a concurrent first-time create fail with
  // the existing unique user index instead of overwriting the winner's cart.
  return cartsCollection.findOneAndUpdate(
    { userId, revision: { $exists: false } },
    {
      $set: { items, updatedAt: now },
      $inc: { revision: 1 },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true, returnDocument: "after" },
  );
}

type CartMutation = (
  cart: CartDoc | null,
) => Promise<CartItemDoc[] | null>;

async function mutateCart(
  userId: string,
  mutate: CartMutation,
  createIfMissing: boolean,
): Promise<CartDoc | null> {
  for (let attempt = 0; attempt < CART_MUTATION_RETRIES; attempt += 1) {
    const cart = await cartsCollection.findOne({ userId });
    const items = await mutate(cart);

    if (items === null) {
      return null;
    }

    if (!cart && !createIfMissing) {
      return null;
    }

    try {
      const updated = await writeCartItems(userId, cart, items);

      if (updated) {
        return updated;
      }
    } catch (error) {
      if (!(error instanceof MongoServerError && error.code === 11000)) {
        throw error;
      }
    }
  }

  throw new ApiError(409, CART_CONFLICT_MESSAGE, "CART_CONFLICT");
}

function requireUpdatedCart(cart: CartDoc | null): CartDoc {
  if (!cart) {
    throw new ApiError(409, CART_CONFLICT_MESSAGE, "CART_CONFLICT");
  }

  return cart;
}

async function loadCartForUser(userId: string): Promise<CartDoc | null> {
  const cart = await cartsCollection.findOne({ userId });

  if (!cart || cart.items.length === 0) {
    return cart;
  }

  const products = await productsCollection
    .find(
      { _id: { $in: cart.items.map((item) => item.productId) } },
      { projection: { _id: 1 } },
    )
    .toArray();
  const existingIds = new Set(
    products.map((product) => product._id.toHexString()),
  );
  const missingIds = new Set(
    cart.items
      .filter((item) => !existingIds.has(item.productId.toHexString()))
      .map((item) => item.productId.toHexString()),
  );

  if (missingIds.size === 0) {
    return cart;
  }

  // Removing orphans is itself revision-guarded, so a concurrent add/update is
  // retried instead of being overwritten by the cleanup.
  return mutateCart(
    userId,
    async (current) => {
      if (!current) {
        return null;
      }

      return current.items.filter(
        (item) => !missingIds.has(item.productId.toHexString()),
      );
    },
    false,
  );
}

export async function getCartForUser(userId: string): Promise<Cart> {
  const cart = await loadCartForUser(userId);
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

  // Categories can be hidden without editing every product inside them. Treat
  // a hidden category as unavailable for new cart changes; a dangling category
  // reference stays lenient, matching the catalog and checkout policy.
  const category = await categoriesCollection.findOne(
    { _id: product.categoryId },
    { projection: { active: 1 } },
  );

  if (category && !category.active) {
    throw conflict("This product category is no longer available.");
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

  const updated = await mutateCart(
    userId,
    async (cart) => {
      const product = await findActiveProduct(productId);
      const items = cart?.items ? [...cart.items] : [];
      const existingIndex = items.findIndex((item) =>
        item.productId.equals(productId),
      );
      const existingQuantity =
        existingIndex >= 0 ? items[existingIndex].quantity : 0;
      const nextQuantity = existingQuantity + quantity;

      if (
        !Number.isSafeInteger(nextQuantity) ||
        nextQuantity < 1 ||
        nextQuantity > MAX_QUANTITY
      ) {
        throw new ValidationError(
          `Quantity cannot exceed ${MAX_QUANTITY} for one item.`,
        );
      }

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

      return items;
    },
    true,
  );

  return serializeCart(requireUpdatedCart(updated));
}

export async function updateCartItem(
  userId: string,
  productIdValue: string,
  raw: unknown,
): Promise<Cart> {
  const productId = parseObjectId(productIdValue, "Product");
  const body = asRecord(raw);
  const quantity = readQuantity(body.quantity, true);

  const updated = await mutateCart(
    userId,
    async (cart) => {
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
        return cart.items.filter((item) => !item.productId.equals(productId));
      }

      const product = await findActiveProduct(productId);
      assertStock(product, quantity);

      return cart.items.map((item) =>
        item.productId.equals(productId) ? { ...item, quantity } : item,
      );
    },
    false,
  );

  return serializeCart(requireUpdatedCart(updated));
}

export async function removeCartItem(
  userId: string,
  productIdValue: string,
): Promise<Cart> {
  const productId = parseObjectId(productIdValue, "Product");

  const updated = await mutateCart(
    userId,
    async (cart) => {
      if (!cart) {
        return null;
      }

      return cart.items.filter((item) => !item.productId.equals(productId));
    },
    false,
  );

  return updated ? serializeCart(updated) : emptyCart();
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

export async function getCartDocument(userId: string) {
  return loadCartForUser(userId);
}

/**
 * Safely removes purchased items from a user's cart without discarding
 * concurrently added products or extra quantities added during checkout.
 */
export async function clearPurchasedCartItems(
  userId: string,
  purchasedItems: Array<{ productId: ObjectId; quantity: number }>,
): Promise<CartDoc | null> {
  if (!purchasedItems || purchasedItems.length === 0) {
    return null;
  }

  const purchasedMap = new Map<string, number>();
  for (const item of purchasedItems) {
    const key = item.productId.toHexString();
    purchasedMap.set(key, (purchasedMap.get(key) ?? 0) + item.quantity);
  }

  return mutateCart(
    userId,
    async (cart) => {
      if (!cart || cart.items.length === 0) {
        return [];
      }

      const nextItems: CartItemDoc[] = [];
      for (const item of cart.items) {
        const key = item.productId.toHexString();
        const purchasedQty = purchasedMap.get(key) ?? 0;

        if (purchasedQty > 0) {
          const remainingQty = item.quantity - purchasedQty;
          if (remainingQty > 0) {
            nextItems.push({
              ...item,
              quantity: remainingQty,
            });
          }
        } else {
          nextItems.push(item);
        }
      }

      return nextItems;
    },
    false,
  );
}
