import { randomBytes } from "node:crypto";
import {
  MongoServerError,
  ObjectId,
  type ClientSession,
  type Filter,
} from "mongodb";
import {
  cartsCollection,
  categoriesCollection,
  couponsCollection,
  ordersCollection,
  productsCollection,
} from "@/lib/db/collections";
import type {
  CartDoc,
  CheckoutSnapshotDoc,
  CouponDoc,
  OrderDoc,
  OrderItemDoc,
  OrderStatusEventDoc,
  ProductDoc,
  ShippingAddressDoc,
} from "@/lib/db/types";
import {
  ApiError,
  conflict,
  forbidden,
  notFound,
  ValidationError,
} from "@/lib/errors";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  MAX_QUANTITY,
  ORDER_STATUS_TRANSITIONS,
  SHIPPING_FEE_CENTS,
} from "@/lib/constants";
import type { CurrentUser } from "@/lib/auth/session";
import type { Coupon, Order, OrderStatus, OrderSummary } from "@/lib/types";
import { runOptionalTransaction, supportsTransactions } from "@/lib/db/transactions";
import { getCartDocument, clearPurchasedCartItems } from "@/lib/services/cart";
import { getAddressForUser, addressToShipping } from "@/lib/services/addresses";
import { validateCoupon, assertCouponEligible } from "@/lib/services/coupons";
import {
  asRecord,
  normalizeEmail,
  parseObjectId,
  readOptionalString,
  readString,
} from "@/lib/validation";

function generateOrderNumber(now: Date) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `SS-${date}-${suffix}`;
}

function findOrderByCheckoutKey(userId: string, checkoutKey: string) {
  return ordersCollection.findOne({ userId, checkoutKey });
}

const CHECKOUT_KEY_INDEX_NAME = "orders_user_checkout_key_uidx";
/**
 * Reservation state machine
 * =========================
 *
 *   insert order (inventoryState=reserving)
 *     -> apply stock/coupon effects (each effect carries an order-scoped marker)
 *     -> verify cart snapshot
 *     -> inventoryState=reserved (fulfillable; cart may then be cleared)
 *     -> cancel/abort: inventoryState=releasing (atomic claim)
 *     -> restore each effect (restoration marker is atomic with the increment)
 *     -> inventoryState=released (terminal)
 *
 * Crash windows:
 * - Before the order insert: no effects exist; nothing to recover.
 * - After insert, before/among reservations: order is `reserving`; recovery
 *   aborts it and restores only the effects whose reservation marker exists.
 * - After all reservations, before `reserved`: same as above; recovery aborts
 *   (deterministic fail-closed policy).
 * - After `reserved`, before cart clear: the order stands; a retry reuses the
 *   same checkout key. Cart clearing is conditional and idempotent.
 * - During `releasing`: the order keeps the claim and is retried by recovery.
 *
 * Ambiguous acknowledgements are resolved by re-reading the order and the
 * per-effect markers. A thrown write is never treated as proof that the effect
 * did not happen. Every effect is idempotent because the marker and the
 * stock/counter mutation land in one document update.
 *
 * `inventoryClaim` is a short lease. Only the claim holder applies or restores
 * effects; another worker may take over only after the lease expires. A stale
 * holder that resumes cannot double-apply because the markers are still in the
 * product/coupon document (they are never truncated).
 */
const INVENTORY_CLAIM_LEASE_MS = 60_000;
const RESERVING_RECOVERY_GRACE_MS = 60_000;
const CHECKOUT_RETRY_MESSAGE =
  "The previous checkout attempt did not complete. Review your cart and try again.";
const ORDER_NOT_RESERVED_MESSAGE =
  "This order is still reserving inventory and cannot be fulfilled yet.";
const RELEASE_IN_PROGRESS_MESSAGE =
  "This order's inventory release is already in progress. Refresh and try again.";

type EffectMarker = { orderId: ObjectId; at: Date };

function hasEffectMarker(
  markers: EffectMarker[] | undefined,
  orderId: ObjectId,
): boolean {
  return Boolean(
    markers?.some((marker) => marker.orderId.equals(orderId)),
  );
}

function claimCutoff(now = Date.now()) {
  return new Date(now - INVENTORY_CLAIM_LEASE_MS);
}

function staleClaimFilter(now = Date.now()) {
  return {
    $or: [
      { inventoryClaim: { $exists: false } },
      { inventoryClaim: null },
      { "inventoryClaim.at": { $lt: claimCutoff(now) } },
    ],
  };
}

function isClaimFresh(
  order: Pick<OrderDoc, "inventoryClaim">,
  now = Date.now(),
) {
  return Boolean(
    order.inventoryClaim &&
      order.inventoryClaim.at.getTime() > now - INVENTORY_CLAIM_LEASE_MS,
  );
}

function releaseFailed(message: string) {
  return new ApiError(409, message, "INVENTORY_RELEASE_FAILED");
}

/**
 * Without this partial unique index two concurrent requests carrying the same
 * checkout key can both insert an order. Refusing to start a keyed checkout is
 * safer than silently charging stock twice.
 */
async function assertCheckoutIdempotencyIndex() {
  let indexes;

  try {
    indexes = await ordersCollection.listIndexes().toArray();
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 26) {
      indexes = [];
    } else {
      throw error;
    }
  }

  const index = indexes.find((entry) => entry.name === CHECKOUT_KEY_INDEX_NAME);
  const key = index?.key as Record<string, unknown> | undefined;
  const partial = index?.partialFilterExpression as
    | { checkoutKey?: { $type?: string } }
    | undefined;
  const ready =
    index?.unique === true &&
    key?.userId === 1 &&
    key?.checkoutKey === 1 &&
    partial?.checkoutKey?.$type === "string";

  if (!ready) {
    throw new ApiError(
      503,
      "Checkout is temporarily unavailable because the order idempotency index is missing. Run `npm run db:init` and try again.",
      "CHECKOUT_NOT_READY",
    );
  }
}

function serializeOrder(order: OrderDoc): Order {
  return {
    id: order._id.toHexString(),
    orderNumber: order.orderNumber,
    userId: order.userId,
    customerEmail: order.customerEmail,
    items: order.items.map((item) => ({
      productId: item.productId.toHexString(),
      name: item.name,
      slug: item.slug,
      image: item.image,
      priceInCents: item.priceInCents,
      quantity: item.quantity,
      lineTotalCents: item.lineTotalCents,
    })),
    shippingAddress: order.shippingAddress,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    shippingCents: order.shippingCents,
    totalCents: order.totalCents,
    couponCode: order.couponCode,
    status: order.status,
    paymentStatus: order.paymentStatus,
    inventoryState: order.inventoryState,
    reconciliationRequired: Boolean(order.reconciliationRequired),
    reconciliationError: order.reconciliationError ?? null,
    statusHistory: (order.statusHistory ?? []).map((event) => ({
      status: event.status,
      changedAt: event.changedAt.toISOString(),
    })),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

function serializeOrderSummary(order: OrderDoc): OrderSummary {
  return {
    id: order._id.toHexString(),
    orderNumber: order.orderNumber,
    customerEmail: order.customerEmail,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    totalCents: order.totalCents,
    status: order.status,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt.toISOString(),
  };
}

function parseShippingAddress(rawValue: unknown): ShippingAddressDoc {
  const raw = asRecord(rawValue);
  const phone = readOptionalString(raw.phone, {
    label: "Phone",
    max: 40,
  });

  if (phone && !/^[0-9+().\-\s]{6,40}$/.test(phone)) {
    throw new ValidationError("Phone number contains unsupported characters.");
  }

  return {
    label: readOptionalString(raw.label, { label: "Label", max: 40 }) ?? "Shipping",
    fullName: readString(raw.fullName, { label: "Full name", max: 120 }),
    line1: readString(raw.line1, {
      label: "Address line 1",
      min: 3,
      max: 200,
    }),
    line2: readOptionalString(raw.line2, {
      label: "Address line 2",
      max: 200,
    }),
    city: readString(raw.city, { label: "City", max: 80 }),
    state: readString(raw.state, { label: "State or region", max: 80 }),
    postalCode: readString(raw.postalCode, {
      label: "Postal code",
      min: 2,
      max: 20,
    }),
    country: readString(raw.country, {
      label: "Country",
      min: 2,
      max: 80,
    }),
    phone,
  };
}

type CheckoutLine = {
  product: ProductDoc;
  quantity: number;
  lineTotalCents: number;
};

type CheckoutCartSnapshot = {
  id: ObjectId;
  userId: string;
  revision?: number;
  items: CartDoc["items"];
};

async function loadCheckoutLines(userId: string): Promise<{
  lines: CheckoutLine[];
  cartSnapshot: CheckoutCartSnapshot;
  subtotalCents: number;
}> {
  const cart = await getCartDocument(userId);

  if (!cart || cart.items.length === 0) {
    throw new ValidationError("Your cart is empty.");
  }

  const products = await productsCollection
    .find({ _id: { $in: cart.items.map((item) => item.productId) } })
    .toArray();
  const productMap = new Map(
    products.map((product) => [product._id.toHexString(), product]),
  );
  const categories = await categoriesCollection
    .find({ _id: { $in: products.map((product) => product.categoryId) } })
    .toArray();
  const categoryMap = new Map(
    categories.map((category) => [category._id.toHexString(), category]),
  );
  const lines: CheckoutLine[] = [];

  for (const cartItem of cart.items) {
    const product = productMap.get(cartItem.productId.toHexString());

    if (!product || !product.active) {
      throw conflict(
        `${product?.name ?? "An item"} is no longer available. Remove it from your cart to continue.`,
      );
    }

    // A product is purchasable only when its category is active too. Missing
    // categories are tolerated for historical data.
    const category = categoryMap.get(product.categoryId.toHexString());

    if (category && !category.active) {
      throw conflict(
        `${product.name} is no longer available. Remove it from your cart to continue.`,
      );
    }

    if (
      !Number.isSafeInteger(cartItem.quantity) ||
      cartItem.quantity < 1 ||
      cartItem.quantity > MAX_QUANTITY
    ) {
      throw new ValidationError(
        `Each cart quantity must be a whole number between 1 and ${MAX_QUANTITY}.`,
      );
    }

    if (cartItem.quantity > product.stock) {
      throw conflict(
        `Only ${product.stock} of ${product.name} ${product.stock === 1 ? "is" : "are"} available.`,
      );
    }

    lines.push({
      product,
      quantity: cartItem.quantity,
      lineTotalCents: product.priceInCents * cartItem.quantity,
    });
  }

  if (lines.length === 0) {
    throw conflict("Your cart contains no available products.");
  }

  return {
    lines,
    cartSnapshot: {
      id: cart._id,
      userId: cart.userId,
      revision: cart.revision,
      items: cart.items.map((item) => ({ ...item })),
    },
    subtotalCents: lines.reduce((total, line) => total + line.lineTotalCents, 0),
  };
}

function cartSnapshotFilter(snapshot: CheckoutCartSnapshot): Filter<CartDoc> {
  return {
    _id: snapshot.id,
    userId: snapshot.userId,
    items: snapshot.items,
    ...(snapshot.revision === undefined
      ? { revision: { $exists: false } }
      : { revision: snapshot.revision }),
  };
}

const CART_CHANGED_MESSAGE =
  "Your cart changed during checkout. Review your cart and try again.";

async function assertCartUnchanged(
  snapshot: CheckoutCartSnapshot,
  session?: ClientSession,
) {
  const current = await cartsCollection.findOne(cartSnapshotFilter(snapshot), {
    session,
    projection: { _id: 1 },
  });

  if (!current) {
    throw conflict(CART_CHANGED_MESSAGE);
  }
}

async function clearCheckedOutCart(
  snapshot: CheckoutCartSnapshot,
  session?: ClientSession,
) {
  const result = await cartsCollection.updateOne(
    cartSnapshotFilter(snapshot),
    {
      $set: { items: [], updatedAt: new Date() },
      $inc: { revision: 1 },
    },
    { session },
  );

  if (result.modifiedCount !== 1) {
    throw conflict(CART_CHANGED_MESSAGE);
  }
}

async function resolveShippingAddress(
  userId: string,
  rawValue: unknown,
): Promise<ShippingAddressDoc> {
  const raw = asRecord(rawValue);

  if (typeof raw.addressId === "string" && raw.addressId) {
    const address = await getAddressForUser(userId, raw.addressId);
    return addressToShipping(address);
  }

  const shipping = raw.shipping ?? raw;

  if (!shipping || typeof shipping !== "object") {
    throw new ValidationError("Shipping address is required.");
  }

  return parseShippingAddress(shipping);
}

async function productHasReservationMarker(
  productId: ObjectId,
  orderId: ObjectId,
  session?: ClientSession,
) {
  const product = await productsCollection.findOne(
    { _id: productId },
    { session, projection: { inventoryReservations: 1 } },
  );

  return Boolean(product && hasEffectMarker(product.inventoryReservations, orderId));
}

async function couponHasReservationMarker(
  couponId: ObjectId,
  orderId: ObjectId,
  session?: ClientSession,
) {
  const coupon = await couponsCollection.findOne(
    { _id: couponId },
    { session, projection: { couponReservations: 1 } },
  );

  return Boolean(coupon && hasEffectMarker(coupon.couponReservations, orderId));
}

async function reserveCheckoutCategories(
  orderId: ObjectId,
  categoryIds: ObjectId[],
  session?: ClientSession,
) {
  for (const categoryId of categoryIds) {
    const at = new Date();
    const result = await categoriesCollection.updateOne(
      {
        _id: categoryId,
        active: true,
        "checkoutReservations.orderId": { $ne: orderId },
      },
      { $push: { checkoutReservations: { orderId, at } } },
      { session },
    );

    if (result.modifiedCount === 1) {
      continue;
    }

    const category = await categoriesCollection.findOne(
      { _id: categoryId },
      { session, projection: { active: 1, checkoutReservations: 1 } },
    );

    if (!category) {
      // Historical products with dangling category references remain eligible,
      // matching the catalog's existing missing-category policy.
      continue;
    }

    if (!category.active) {
      throw conflict("A product category became unavailable during checkout.");
    }

    if (hasEffectMarker(category.checkoutReservations, orderId)) {
      continue;
    }

    throw conflict("A product category changed during checkout. Try again.");
  }
}

async function releaseCheckoutCategories(
  order: OrderDoc,
  session?: ClientSession,
) {
  if (order.categoryReservationsReleasedAt) {
    return;
  }

  const categoryIds = order.checkout?.categoryIds ?? [];
  if (categoryIds.length > 0) {
    await categoriesCollection.updateMany(
      { _id: { $in: categoryIds }, "checkoutReservations.orderId": order._id },
      { $pull: { checkoutReservations: { orderId: order._id } } },
      { session },
    );
  }

  await ordersCollection.updateOne(
    { _id: order._id, categoryReservationsReleasedAt: null },
    { $set: { categoryReservationsReleasedAt: new Date() } },
    { session },
  );
}

/**
 * Applies one stock decrement. If the write throws, the product marker is
 * re-read before deciding the effect is absent. The marker and the `$inc` are
 * in one document update, so a retry is always safe.
 */
async function reserveProductLine(
  orderId: ObjectId,
  line: CheckoutLine,
  session?: ClientSession,
) {
  const at = new Date();

  try {
    const result = await productsCollection.updateOne(
      {
        _id: line.product._id,
        active: true,
        // The checkout snapshot is only valid while the product remains in
        // the category whose checkout lock was acquired. Reassignment can
        // race after loadCheckoutLines(), so validate against the live record
        // in the same atomic write as the stock decrement.
        categoryId: line.product.categoryId,
        stock: { $gte: line.quantity },
        "inventoryReservations.orderId": { $ne: orderId },
        // A restoration marker is also a permanent per-order fence. Recovery
        // can therefore win atomically against a stale worker on this product.
        "inventoryRestorations.orderId": { $ne: orderId },
      },
      {
        $inc: { stock: -line.quantity },
        $set: { updatedAt: at },
        $push: { inventoryReservations: { orderId, at } },
      },
      { session },
    );

    if (result.modifiedCount === 1) {
      return;
    }
  } catch (error) {
    try {
      if (await productHasReservationMarker(line.product._id, orderId, session)) {
        return;
      }
    } catch {
      // Re-reading also failed: leave the outcome uncertain. The caller leaves
      // the order in a recoverable state; recovery re-checks the marker.
    }

    throw error;
  }

  const current = await productsCollection.findOne(
    { _id: line.product._id },
    {
      session,
      projection: {
        active: 1,
        categoryId: 1,
        stock: 1,
        inventoryReservations: 1,
      },
    },
  );

  if (current && hasEffectMarker(current.inventoryReservations, orderId)) {
    return;
  }

  if (!current || !current.active) {
    throw conflict(
      `${line.product.name} is no longer available. Remove it from your cart to continue.`,
    );
  }

  if (!current.categoryId.equals(line.product.categoryId)) {
    throw conflict(
      `${line.product.name}'s category changed during checkout. Refresh your cart and try again.`,
    );
  }

  throw conflict(
    `${line.product.name} no longer has enough stock. Refresh your cart and try again.`,
  );
}

/**
 * Applies the coupon increment with an order-scoped marker. Eligibility is
 * re-checked immediately before the write, preserving the existing coupon
 * limits while making the increment idempotent.
 */
async function reserveCouponForOrder(
  orderId: ObjectId,
  coupon: Coupon | null,
  subtotalCents: number,
  session?: ClientSession,
) {
  if (!coupon) {
    return;
  }

  const couponId = parseObjectId(coupon.id, "Coupon ID");

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const current = await couponsCollection.findOne(
      { _id: couponId },
      { session },
    );

    if (!current) {
      throw new ValidationError("Coupon code was not found.");
    }

    if (hasEffectMarker(current.couponReservations, orderId)) {
      return;
    }

    if (hasEffectMarker(current.couponRestorations, orderId)) {
      throw conflict("This checkout's coupon reservation has already been released.");
    }

    assertCouponEligible(current, subtotalCents);
    const at = new Date();

    try {
      const result = await couponsCollection.updateOne(
        {
          _id: couponId,
          usedCount: current.usedCount,
          "couponReservations.orderId": { $ne: orderId },
          "couponRestorations.orderId": { $ne: orderId },
        },
        {
          $inc: { usedCount: 1 },
          $set: { updatedAt: at },
          $push: { couponReservations: { orderId, at } },
        },
        { session },
      );

      if (result.modifiedCount === 1) {
        return;
      }
    } catch (error) {
      try {
        if (await couponHasReservationMarker(couponId, orderId, session)) {
          return;
        }
      } catch {
        // Same as stock: keep the order recoverable rather than guessing.
      }

      throw error;
    }
  }

  throw conflict("That coupon was just used by another order. Try again.");
}

let lastOpportunisticRecoveryAt = 0;
const OPPORTUNISTIC_RECOVERY_INTERVAL_MS = 60_000;

function triggerOpportunisticRecovery() {
  const now = Date.now();
  if (now - lastOpportunisticRecoveryAt > OPPORTUNISTIC_RECOVERY_INTERVAL_MS) {
    lastOpportunisticRecoveryAt = now;
    recoverPendingInventoryReleases(10).catch((error) => {
      console.warn("[orders] Background opportunistic recovery error:", error);
    });
  }
}

export async function createOrder(
  user: CurrentUser,
  raw: unknown,
): Promise<Order> {
  triggerOpportunisticRecovery();
  const body = asRecord(raw);
  const checkoutKey = readString(body.checkoutKey, {
    label: "Checkout key",
    min: 16,
    max: 80,
    pattern: /^[A-Za-z0-9_-]+$/,
    patternMessage: "Checkout key is not valid.",
  });

  const existing = await findOrderByCheckoutKey(user.id, checkoutKey);

  if (existing) {
    return continueExistingCheckout(existing);
  }

  // Every checkout must be idempotent. Fail before any stock or coupon
  // mutation if duplicate-key protection is not available.
  await assertCheckoutIdempotencyIndex();

  const shippingAddress = await resolveShippingAddress(user.id, body);
  const { lines, subtotalCents, cartSnapshot } = await loadCheckoutLines(user.id);
  const couponCode = readOptionalString(body.couponCode, {
    label: "Coupon code",
    max: 30,
  });
  const couponPreview = couponCode
    ? await validateCoupon(couponCode, subtotalCents)
    : null;
  const discountCents = couponPreview?.discountCents ?? 0;
  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FEE_CENTS;
  const totalCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  const now = new Date();
  const claimToken = new ObjectId().toHexString();
  const items: OrderItemDoc[] = lines.map((line) => ({
    productId: line.product._id,
    name: line.product.name,
    slug: line.product.slug,
    image: line.product.images?.[0] ?? null,
    priceInCents: line.product.priceInCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents,
  }));
  const checkout: CheckoutSnapshotDoc = {
    cartId: cartSnapshot.id,
    cartRevision: cartSnapshot.revision ?? null,
    cartItems: cartSnapshot.items.map((item) => ({ ...item })),
    categoryIds: [...new Map(
      lines.map((line) => [line.product.categoryId.toHexString(), line.product.categoryId]),
    ).values()],
    startedAt: now,
  };
  const baseOrder: OrderDoc = {
    _id: new ObjectId(),
    orderNumber: generateOrderNumber(now),
    userId: user.id,
    customerEmail: normalizeEmail(user.email),
    items,
    shippingAddress,
    subtotalCents,
    discountCents,
    shippingCents,
    totalCents,
    couponId: couponPreview
      ? parseObjectId(couponPreview.coupon.id, "Coupon ID")
      : null,
    couponCode: couponPreview?.coupon.code ?? null,
    status: "pending",
    paymentStatus: "unpaid",
    inventoryState: "reserving",
    checkout,
    inventoryClaim: { token: claimToken, at: now },
    reservationCompletedAt: null,
    cartClearedAt: null,
    categoryReservationsReleasedAt: null,
    statusHistory: [
      {
        status: "pending",
        changedAt: now,
        changedByAdminId: null,
      },
    ],
    ...(checkoutKey ? { checkoutKey } : {}),
    createdAt: now,
    updatedAt: now,
  };

  if (!(await supportsTransactions())) {
    return createOrderWithDurableReservation(
      user,
      baseOrder,
      lines,
      subtotalCents,
      couponPreview,
      cartSnapshot,
      claimToken,
    );
  }

  // Transactions keep their atomic all-or-nothing behaviour. The order is
  // inserted with `reserved` because stock, coupon, order, and cart commit
  // together; no compensation record is required.
  const transactionalOrder: OrderDoc = {
    ...baseOrder,
    inventoryState: "reserved",
    inventoryClaim: null,
    reservationCompletedAt: now,
  };

  try {
    return await runOptionalTransaction(async (session) => {
      await assertCartUnchanged(cartSnapshot, session);
      await reserveCheckoutCategories(
        transactionalOrder._id,
        transactionalOrder.checkout?.categoryIds ?? [],
        session,
      );

      for (const line of lines) {
        await reserveProductLine(transactionalOrder._id, line, session);
      }

      await reserveCouponForOrder(
        transactionalOrder._id,
        couponPreview?.coupon ?? null,
        subtotalCents,
        session,
      );
      await ordersCollection.insertOne(transactionalOrder, { session });
      await clearCheckedOutCart(cartSnapshot, session);
      const clearedAt = new Date();
      await ordersCollection.updateOne(
        { _id: transactionalOrder._id, inventoryState: "reserved" },
        { $set: { cartClearedAt: clearedAt, updatedAt: clearedAt } },
        { session },
      );
      await releaseCheckoutCategories(
        { ...transactionalOrder, cartClearedAt: clearedAt },
        session,
      );
      return serializeOrder({
        ...transactionalOrder,
        cartClearedAt: clearedAt,
        categoryReservationsReleasedAt: clearedAt,
        updatedAt: clearedAt,
      });
    });
  } catch (error) {
    // Two retries with the same key can both get past the initial lookup.
    // The partial unique index decides the winner; the loser returns the
    // winner's already-created order instead of reporting a second checkout.
    if (checkoutKey) {
      const existing = await findOrderByCheckoutKey(
        user.id,
        checkoutKey,
      ).catch(() => null);

      if (existing?.inventoryState === "reserved") {
        return serializeOrder(await clearCartForOrder(existing));
      }

      if (existing) {
        return continueExistingCheckout(existing);
      }
    }

    throw error;
  }
}

type ClaimedOrder = { order: OrderDoc; token: string };

function cartSnapshotFromOrder(
  order: OrderDoc,
): CheckoutCartSnapshot | null {
  if (!order.checkout) {
    return null;
  }

  return {
    id: order.checkout.cartId,
    userId: order.userId,
    revision: order.checkout.cartRevision ?? undefined,
    items: order.checkout.cartItems,
  };
}

/**
 * Clears the checkout cart only when it still matches the recorded snapshot.
 * This runs after the order is durably `reserved`, so a failed clear never
 * invalidates the order and never deletes the cart's newer contents.
 */
async function clearCartForOrder(order: OrderDoc): Promise<OrderDoc> {
  await releaseCheckoutCategories(order);

  if (order.cartClearedAt) {
    return order;
  }

  const snapshot = cartSnapshotFromOrder(order);

  if (!snapshot) {
    return order;
  }

  try {
    await clearCheckedOutCart(snapshot);
  } catch {
    // If exact snapshot matching failed because of concurrent cart updates,
    // safely clear only the purchased items/quantities, preserving any newly
    // added or quantity-updated items.
    try {
      await clearPurchasedCartItems(order.userId, snapshot.items);
    } catch (clearError) {
      console.warn(
        `[orders] Order ${order._id.toHexString()} could not clear purchased items from cart; leaving retryable:`,
        clearError,
      );
      return order;
    }
  }

  const at = new Date();
  const updated = await ordersCollection
    .findOneAndUpdate(
      { _id: order._id, inventoryState: "reserved", cartClearedAt: null },
      { $set: { cartClearedAt: at, updatedAt: at } },
      { returnDocument: "after" },
    )
    .catch(() => null);

  return (
    updated ??
    (await ordersCollection.findOne({ _id: order._id }).catch(() => null)) ??
    order
  );
}

async function waitForCheckoutOutcome(
  orderId: ObjectId,
  timeoutMs = 3_000,
) {
  const deadline = Date.now() + timeoutMs;
  let current = await ordersCollection.findOne({ _id: orderId });

  while (
    current?.inventoryState === "reserving" &&
    Date.now() < deadline
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    current = await ordersCollection.findOne({ _id: orderId });
  }

  return current;
}

/**
 * Resolves a retried checkout key. A `reserved` order is the idempotent
 * success. A `reserving` order is either still owned by a live request or a
 * crash remnant; the latter is aborted (never silently fulfilled). Released
 * orders are reported as a failed attempt so the client rotates its key.
 */
async function continueExistingCheckout(order: OrderDoc): Promise<Order> {
  if (order.inventoryState === "reserved") {
    return serializeOrder(await clearCartForOrder(order));
  }

  if (order.inventoryState === "reserving") {
    const current = isClaimFresh(order)
      ? await waitForCheckoutOutcome(order._id)
      : order;

    if (current?.inventoryState === "reserved") {
      return serializeOrder(await clearCartForOrder(current));
    }

    if (
      current?.inventoryState === "reserving" &&
      isClaimFresh(current)
    ) {
      throw new ApiError(
        409,
        "This checkout is still being processed. Retry in a moment.",
        "CHECKOUT_IN_PROGRESS",
      );
    }

    const recovered = await recoverReservingOrder(order._id).catch((error: unknown) => {
      console.error(
        `[orders] Failed to abort interrupted checkout ${order._id.toHexString()}:`,
        error,
      );
      return null;
    });

    if (recovered?.inventoryState === "reserved") {
      return serializeOrder(await clearCartForOrder(recovered));
    }

    if (recovered?.inventoryState === "released") {
      throw new ApiError(409, CHECKOUT_RETRY_MESSAGE, "CHECKOUT_RETRY_REQUIRED");
    }

    throw new ApiError(
      409,
      "This checkout is still being processed. Retry in a moment.",
      "CHECKOUT_IN_PROGRESS",
    );
  }

  if (order.inventoryState === "releasing") {
    const recovered = await recoverReleasingOrder(order._id).catch((error: unknown) => {
      console.error(
        `[orders] Failed to finish interrupted release ${order._id.toHexString()}:`,
        error,
      );
      return null;
    });

    if (recovered?.inventoryState === "released") {
      throw new ApiError(409, CHECKOUT_RETRY_MESSAGE, "CHECKOUT_RETRY_REQUIRED");
    }

    throw new ApiError(
      409,
      "This checkout is still being processed. Retry in a moment.",
      "CHECKOUT_IN_PROGRESS",
    );
  }

  throw new ApiError(409, CHECKOUT_RETRY_MESSAGE, "CHECKOUT_RETRY_REQUIRED");
}

async function createOrderWithDurableReservation(
  user: CurrentUser,
  order: OrderDoc,
  lines: CheckoutLine[],
  subtotalCents: number,
  couponPreview: Awaited<ReturnType<typeof validateCoupon>> | null,
  cartSnapshot: CheckoutCartSnapshot,
  claimToken: string,
) {
  try {
    await ordersCollection.insertOne(order);
  } catch (error) {
    // A write that applied but threw an acknowledgement error is not absent.
    // Re-read by durable identity before deciding anything.
    let persisted = await ordersCollection
      .findOne({ _id: order._id })
      .catch(() => null);

    if (!persisted && order.checkoutKey) {
      persisted = await findOrderByCheckoutKey(
        user.id,
        order.checkoutKey,
      ).catch(() => null);
    }

    if (!persisted) {
      throw error;
    }

    if (!persisted._id.equals(order._id)) {
      return continueExistingCheckout(persisted);
    }

    return finalizeDurableReservation(
      persisted,
      lines,
      subtotalCents,
      couponPreview,
      cartSnapshot,
      claimToken,
    );
  }

  return finalizeDurableReservation(
    order,
    lines,
    subtotalCents,
    couponPreview,
    cartSnapshot,
    claimToken,
  );
}

async function finalizeDurableReservation(
  order: OrderDoc,
  lines: CheckoutLine[],
  subtotalCents: number,
  couponPreview: Awaited<ReturnType<typeof validateCoupon>> | null,
  cartSnapshot: CheckoutCartSnapshot,
  claimToken: string,
) {
  try {
    const now = new Date();
    const claimed = await ordersCollection.findOneAndUpdate(
      {
        _id: order._id,
        inventoryState: "reserving",
        $or: [
          { "inventoryClaim.token": claimToken },
          ...staleClaimFilter(now.getTime()).$or,
        ],
      },
      { $set: { inventoryClaim: { token: claimToken, at: now } } },
      { returnDocument: "after" },
    );

    if (!claimed) {
      const current = await ordersCollection.findOne({ _id: order._id });

      if (!current) {
        throw new ApiError(
          500,
          "The checkout record could not be loaded.",
          "CHECKOUT_FAILED",
        );
      }

      return continueExistingCheckout(current);
    }

    await reserveCheckoutCategories(
      order._id,
      order.checkout?.categoryIds ?? [],
    );

    for (const line of lines) {
      await reserveProductLine(order._id, line);
    }

    await reserveCouponForOrder(
      order._id,
      couponPreview?.coupon ?? null,
      subtotalCents,
    );

    // Final cart guard. A change before this point aborts the whole checkout.
    await assertCartUnchanged(cartSnapshot);

    const reservedAt = new Date();
    const reserved = await ordersCollection.findOneAndUpdate(
      {
        _id: order._id,
        inventoryState: "reserving",
        "inventoryClaim.token": claimToken,
      },
      {
        $set: {
          inventoryState: "reserved",
          inventoryClaim: null,
          reservationCompletedAt: reservedAt,
          updatedAt: reservedAt,
        },
      },
      { returnDocument: "after" },
    );

    if (!reserved) {
      const current = await ordersCollection.findOne({ _id: order._id });

      if (current?.inventoryState === "reserved") {
        return serializeOrder(await clearCartForOrder(current));
      }

      throw new ApiError(409, CHECKOUT_RETRY_MESSAGE, "CHECKOUT_RETRY_REQUIRED");
    }

    return serializeOrder(await clearCartForOrder(reserved));
  } catch (error) {
    const current = await ordersCollection
      .findOne({ _id: order._id })
      .catch(() => null);

    if (current?.inventoryState === "reserving") {
      await abortReservationWithToken(order._id, claimToken).catch(
        (abortError: unknown) => {
          console.error(
            `[orders] Failed to abort checkout ${order._id.toHexString()}; it remains recoverable:`,
            abortError,
          );
        },
      );
    }

    // A concurrent request may have won the checkout-key race with a fully
    // reserved order. Return that order rather than a duplicate failure.
    if (order.checkoutKey) {
      const existing = await findOrderByCheckoutKey(
        order.userId,
        order.checkoutKey,
      ).catch(() => null);

      if (existing?.inventoryState === "reserved") {
        return serializeOrder(await clearCartForOrder(existing));
      }
    }

    // If cleanup completed (or is underway) the checkout key is spent for this
    // cart revision. Tell the client to rotate it. Do not do this while the
    // order is still `reserving`: a second key could duplicate the attempt
    // before recovery has settled the first one.
    const settled = await ordersCollection
      .findOne({ _id: order._id })
      .catch(() => null);

    if (
      error instanceof ApiError &&
      (settled?.inventoryState === "releasing" ||
        settled?.inventoryState === "released")
    ) {
      throw new ApiError(
        error.status,
        error.message,
        "CHECKOUT_RETRY_REQUIRED",
      );
    }

    throw error;
  }
}

async function abortReservationWithToken(
  orderId: ObjectId,
  token: string,
): Promise<OrderDoc | null> {
  const now = new Date();
  const releasing = await ordersCollection.findOneAndUpdate(
    {
      _id: orderId,
      inventoryState: "reserving",
      "inventoryClaim.token": token,
    },
    {
      $set: {
        status: "cancelled",
        inventoryState: "releasing",
        lastRecoveryAt: now,
        updatedAt: now,
      },
      $push: {
        statusHistory: {
          status: "cancelled" as const,
          changedAt: now,
          changedByAdminId: null,
        },
      },
    },
    { returnDocument: "after" },
  );

  if (!releasing) {
    return ordersCollection.findOne({ _id: orderId });
  }

  return finishInventoryRelease(releasing, token);
}

async function claimReservingForAbort(
  orderId: ObjectId,
): Promise<ClaimedOrder | null> {
  const now = new Date();
  const token = new ObjectId().toHexString();
  const claimed = await ordersCollection.findOneAndUpdate(
    {
      _id: orderId,
      inventoryState: "reserving",
      updatedAt: {
        $lt: new Date(now.getTime() - RESERVING_RECOVERY_GRACE_MS),
      },
      ...staleClaimFilter(now.getTime()),
    },
    {
      $set: {
        status: "cancelled",
        inventoryState: "releasing",
        inventoryClaim: { token, at: now },
        lastRecoveryAt: now,
        updatedAt: now,
      },
      $push: {
        statusHistory: {
          status: "cancelled" as const,
          changedAt: now,
          changedByAdminId: null,
        },
      },
    },
    { returnDocument: "after" },
  );

  return claimed ? { order: claimed, token } : null;
}

async function claimReleasingOrder(
  orderId: ObjectId,
): Promise<ClaimedOrder | null> {
  const now = new Date();
  const token = new ObjectId().toHexString();
  const claimed = await ordersCollection.findOneAndUpdate(
    { _id: orderId, inventoryState: "releasing", ...staleClaimFilter(now.getTime()) },
    {
      $set: {
        inventoryClaim: { token, at: now },
        lastRecoveryAt: now,
        updatedAt: now,
      },
    },
    { returnDocument: "after" },
  );

  return claimed ? { order: claimed, token } : null;
}

async function recoverReservingOrder(orderId: ObjectId) {
  const claimed = await claimReservingForAbort(orderId);

  if (!claimed) {
    return ordersCollection.findOne({ _id: orderId });
  }

  return finishInventoryRelease(claimed.order, claimed.token);
}

async function recoverReleasingOrder(orderId: ObjectId) {
  const claimed = await claimReleasingOrder(orderId);

  if (!claimed) {
    return ordersCollection.findOne({ _id: orderId });
  }

  return finishInventoryRelease(claimed.order, claimed.token);
}

type ReleaseOptions = {
  /**
   * New-schema orders must prove the reservation marker before restoring.
   * Legacy orders (created before reservations were recorded) rely on the old
   * `inventoryState` semantics.
   */
  requireReservation: boolean;
  /**
   * True while aborting an incomplete reservation: a line with no reservation
   * marker was never applied, so there is nothing to restore. False for a
   * completed reservation, where a missing marker is a data inconsistency.
   */
  allowUnreserved: boolean;
};

/**
 * Restores one line exactly once. The reservation marker proves the decrement
 * happened; the restoration marker proves the increment happened. Both the
 * marker and the `$inc` are written atomically. A thrown acknowledgement is
 * resolved by the next recovery pass through the idempotent filter.
 */
async function restoreProductStock(
  orderId: ObjectId,
  item: Pick<OrderItemDoc, "productId" | "quantity">,
  options: ReleaseOptions,
  session?: ClientSession,
) {
  const at = new Date();
  const baseFilter: Filter<ProductDoc> = {
    _id: item.productId,
    "inventoryRestorations.orderId": { $ne: orderId },
  };

  if (!options.requireReservation) {
    const legacy = await productsCollection.updateOne(
      baseFilter,
      {
        $inc: { stock: item.quantity },
        $push: { inventoryRestorations: { orderId, at } },
        $set: { updatedAt: at },
      },
      { session },
    );

    if (legacy.modifiedCount === 1) {
      return;
    }
  }

  // The restoration marker closes this order's reservation slot on this
  // product. For an applied reservation, marker + stock increment are atomic.
  const restored = await productsCollection.updateOne(
    {
      ...baseFilter,
      "inventoryReservations.orderId": orderId,
    },
    {
      $inc: { stock: item.quantity },
      $push: { inventoryRestorations: { orderId, at } },
      $set: { updatedAt: at },
    },
    { session },
  );

  if (restored.modifiedCount === 1) {
    return;
  }

  let current = await productsCollection.findOne(
    { _id: item.productId },
    {
      session,
      projection: {
        inventoryReservations: 1,
        inventoryRestorations: 1,
      },
    },
  );

  if (!current) {
    throw releaseFailed(
      "A product referenced by this order no longer exists; inventory cannot be released automatically.",
    );
  }

  if (hasEffectMarker(current.inventoryRestorations, orderId)) {
    return;
  }

  if (!hasEffectMarker(current.inventoryReservations, orderId)) {
    if (options.requireReservation && !options.allowUnreserved) {
      throw releaseFailed(
        "This order has no durable stock-reservation evidence. Manual reconciliation is required.",
      );
    }

    // For an incomplete reservation, install a fence without adding stock.
    // The $ne condition serializes this with a concurrent reservation write.
    const fenced = await productsCollection.updateOne(
      {
        ...baseFilter,
        "inventoryReservations.orderId": { $ne: orderId },
      },
      {
        $push: { inventoryRestorations: { orderId, at } },
        $set: { updatedAt: at },
      },
      { session },
    );

    if (fenced.modifiedCount === 1) {
      return;
    }

    current = await productsCollection.findOne(
      { _id: item.productId },
      { session, projection: { inventoryReservations: 1, inventoryRestorations: 1 } },
    );

    if (current && hasEffectMarker(current.inventoryRestorations, orderId)) {
      return;
    }

    if (current && hasEffectMarker(current.inventoryReservations, orderId)) {
      // Reservation won the product-document race; retry through the atomic
      // restore branch rather than treating the effect as absent.
      const retry = await productsCollection.updateOne(
        {
          ...baseFilter,
          "inventoryReservations.orderId": orderId,
        },
        {
          $inc: { stock: item.quantity },
          $push: { inventoryRestorations: { orderId, at: new Date() } },
          $set: { updatedAt: new Date() },
        },
        { session },
      );

      if (retry.modifiedCount === 1) {
        return;
      }
    }
  }

  current = await productsCollection.findOne(
    { _id: item.productId },
    { session, projection: { inventoryReservations: 1, inventoryRestorations: 1 } },
  );

  if (current && hasEffectMarker(current.inventoryRestorations, orderId)) {
    return;
  }

  throw releaseFailed(
    "Stock restoration did not apply. The order remains queued for recovery.",
  );
}

async function restoreCouponUse(
  orderId: ObjectId,
  couponId: ObjectId,
  options: ReleaseOptions,
  session?: ClientSession,
) {
  const at = new Date();
  const baseFilter: Filter<CouponDoc> = {
    _id: couponId,
    "couponRestorations.orderId": { $ne: orderId },
  };

  if (!options.requireReservation) {
    const legacy = await couponsCollection.updateOne(
      { ...baseFilter, usedCount: { $gt: 0 } },
      {
        $inc: { usedCount: -1 },
        $push: { couponRestorations: { orderId, at } },
        $set: { updatedAt: at },
      },
      { session },
    );

    if (legacy.modifiedCount === 1) {
      return;
    }
  }

  const result = await couponsCollection.updateOne(
    {
      ...baseFilter,
      "couponReservations.orderId": orderId,
      usedCount: { $gt: 0 },
    },
    {
      $inc: { usedCount: -1 },
      $push: { couponRestorations: { orderId, at } },
      $set: { updatedAt: at },
    },
    { session },
  );

  if (result.modifiedCount === 1) {
    return;
  }

  const current = await couponsCollection.findOne(
    { _id: couponId },
    { session, projection: { usedCount: 1, couponReservations: 1, couponRestorations: 1 } },
  );

  if (!current) {
    if (options.requireReservation) {
      throw releaseFailed(
        "The coupon referenced by this order no longer exists; coupon usage cannot be released automatically.",
      );
    }

    return;
  }

  if (hasEffectMarker(current.couponRestorations, orderId)) {
    return;
  }

  if (options.requireReservation) {
    if (!hasEffectMarker(current.couponReservations, orderId)) {
      if (options.allowUnreserved) {
        // This is retried below as a fence-only update so a stale worker
        // cannot increment this coupon after the order is released.
      } else {
        throw releaseFailed(
          "This order has no durable coupon-reservation evidence. Manual reconciliation is required.",
        );
      }
    }

    if (hasEffectMarker(current.couponReservations, orderId) && current.usedCount <= 0) {
      throw releaseFailed(
        "Coupon usage is inconsistent with the reservation record. Manual reconciliation is required.",
      );
    }
  }

  if (!hasEffectMarker(current.couponReservations, orderId)) {
    const fenced = await couponsCollection.updateOne(
      {
        ...baseFilter,
        "couponReservations.orderId": { $ne: orderId },
      },
      {
        $push: { couponRestorations: { orderId, at } },
        $set: { updatedAt: at },
      },
      { session },
    );

    if (fenced.modifiedCount === 1) {
      return;
    }
  }

  const after = await couponsCollection.findOne(
    { _id: couponId },
    { session, projection: { usedCount: 1, couponReservations: 1, couponRestorations: 1 } },
  );

  if (after && hasEffectMarker(after.couponRestorations, orderId)) {
    return;
  }

  throw releaseFailed(
    "Coupon usage restoration did not apply. The order remains queued for recovery.",
  );
}

async function releaseOrderEffects(
  order: OrderDoc,
  options: ReleaseOptions,
  session?: ClientSession,
) {
  const failedErrors: Error[] = [];

  for (const item of order.items) {
    try {
      await restoreProductStock(order._id, item, options, session);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failedErrors.push(err);
      console.error(
        `[orders] Could not restore stock for order ${order._id.toHexString()} product ${item.productId.toHexString()}; it remains queued for recovery:`,
        error,
      );
      if (session) {
        throw error;
      }
    }
  }

  if (order.couponId) {
    try {
      await restoreCouponUse(order._id, order.couponId, options, session);
    } catch (error) {
      console.error(
        `[orders] Could not restore coupon ${order.couponId.toHexString()} for order ${order._id.toHexString()}; it remains queued for recovery:`,
        error,
      );
      throw error;
    }
  }

  if (failedErrors.length > 0) {
    const detail = failedErrors.map((e) => e.message).join("; ");
    throw releaseFailed(
      `The order's inventory release could not be completed: ${detail}`,
    );
  }
}

/**
 * Restores every reservation for a releasing order, then marks it released.
 * The caller must own the inventory claim; the final transition is conditional
 * on that claim, so a stale worker cannot finalize twice.
 */
async function finishInventoryRelease(
  order: OrderDoc,
  token: string,
  session?: ClientSession,
): Promise<OrderDoc> {
  const current = await ordersCollection.findOne({ _id: order._id }, { session });

  if (!current) {
    throw notFound("Order not found.");
  }

  if (current.inventoryState === "released") {
    return current;
  }

  if (current.inventoryState !== "releasing") {
    throw conflict(
      "This order is not in a releasable state. Refresh and try again.",
    );
  }

  if (current.inventoryClaim?.token !== token) {
    throw releaseFailed(RELEASE_IN_PROGRESS_MESSAGE);
  }

  const options: ReleaseOptions = {
    requireReservation: Boolean(current.checkout),
    allowUnreserved: !current.reservationCompletedAt,
  };

  try {
    await releaseOrderEffects(current, options, session);
    await releaseCheckoutCategories(current, session);
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : String(error);
    const isPermanent =
      errMessage.includes("no longer exists") ||
      errMessage.includes("no durable") ||
      (current.recoveryAttempts ?? 0) >= 4;

    const now = new Date();
    // Drop the claim so a retry/recovery can run immediately after a caught
    // failure. A crash leaves the claim to expire instead.
    await ordersCollection
      .updateOne(
        {
          _id: current._id,
          inventoryState: "releasing",
          "inventoryClaim.token": token,
        },
        {
          $set: {
            lastRecoveryAt: now,
            ...(isPermanent
              ? {
                  reconciliationRequired: true,
                  reconciliationError: errMessage,
                }
              : {}),
          },
          $inc: { recoveryAttempts: 1 },
          $unset: { inventoryClaim: "" },
        },
      )
      .catch(() => undefined);

    throw error;
  }

  const now = new Date();
  const released = await ordersCollection.findOneAndUpdate(
    {
      _id: current._id,
      inventoryState: "releasing",
      "inventoryClaim.token": token,
    },
    {
      $set: {
        inventoryState: "released",
        inventoryClaim: null,
        lastRecoveryAt: now,
        updatedAt: now,
      },
    },
    { session, returnDocument: "after" },
  );

  if (released) {
    return released;
  }

  const after = await ordersCollection.findOne({ _id: current._id }, { session });

  if (after?.inventoryState === "released") {
    return after;
  }

  throw releaseFailed(
    "The order's inventory release could not be finalized. It remains queued for recovery.",
  );
}

/**
 * Recovers interrupted checkouts and releases.
 *
 * - `reserving` older than the recovery grace is aborted. Fail-closed: an order
 *   whose reservation never completed is never made fulfillable.
 * - `releasing` is resumed.
 *
 * Candidates are claimed atomically. A malformed record fails in isolation;
 * the order stays in its recoverable state and is logged for an operator.
 * No index is added: this bounded batch relies on the existing order indexes
 * and is intentionally limited.
 */
export async function recoverPendingInventoryReleases(limit = 10) {
  const safeLimit = Math.min(50, Math.max(1, Math.trunc(limit)));
  const now = Date.now();
  const reservingBefore = new Date(now - RESERVING_RECOVERY_GRACE_MS);
  const staleClaims = staleClaimFilter(now).$or;

  // A crash after the order became reserved but before its category lock was
  // cleared must not leave that category permanently undeactivatable.
  const reservedWithCategoryLocks = await ordersCollection
    .find({
      inventoryState: "reserved",
      categoryReservationsReleasedAt: null,
      "checkout.categoryIds.0": { $exists: true },
    })
    .limit(safeLimit)
    .toArray();

  for (const order of reservedWithCategoryLocks) {
    await releaseCheckoutCategories(order).catch((error) => {
      console.warn(
        `[orders] Could not clear category checkout locks for order ${order._id.toHexString()}:`,
        error,
      );
    });
  }

  const pending = await ordersCollection
    .find({
      reconciliationRequired: { $ne: true },
      $or: [
        {
          inventoryState: "releasing",
          $or: staleClaims,
        },
        {
          inventoryState: "reserving",
          updatedAt: { $lt: reservingBefore },
          $or: staleClaims,
        },
      ],
    })
    .sort({ updatedAt: 1 })
    .limit(safeLimit)
    .toArray();
  const failed: string[] = [];
  let released = 0;
  let aborted = 0;

  for (const order of pending) {
    try {
      if (order.inventoryState === "reserving") {
        const claimed = await claimReservingForAbort(order._id);

        if (!claimed) {
          continue;
        }

        await finishInventoryRelease(claimed.order, claimed.token);
        aborted += 1;
        released += 1;
      } else if (order.inventoryState === "releasing") {
        const claimed = await claimReleasingOrder(order._id);

        if (!claimed) {
          continue;
        }

        await finishInventoryRelease(claimed.order, claimed.token);
        released += 1;
      }
    } catch (error) {
      failed.push(order._id.toHexString());
      const attempts = (order.recoveryAttempts ?? 0) + 1;
      console.error(
        `[orders] Recovery failed for order ${order._id.toHexString()} (attempt ${attempts}, state ${order.inventoryState}); it remains queued and requires operator attention if it keeps failing:`,
        error,
      );
    }
  }

  if (failed.length > 0) {
    console.error(
      `[orders] ${failed.length} order(s) still need inventory reconciliation: ${failed.join(", ")}`,
    );
  }

  return { scanned: pending.length, released, aborted, failed };
}

export async function listOrdersForUser(userId: string) {
  const documents = await ordersCollection
    .find({ userId })
    .sort({ createdAt: -1 })
    .toArray();

  return documents.map(serializeOrderSummary);
}

export async function getOrderForUser(
  userId: string,
  orderId: string,
): Promise<Order> {
  const order = await ordersCollection.findOne({
    _id: parseObjectId(orderId, "Order ID"),
    userId,
  });

  if (!order) {
    throw notFound("Order not found.");
  }

  return serializeOrder(order);
}

export async function getOrderForAdmin(orderId: string): Promise<Order> {
  const order = await ordersCollection.findOne({
    _id: parseObjectId(orderId, "Order ID"),
  });

  if (!order) {
    throw notFound("Order not found.");
  }

  return serializeOrder(order);
}

export async function listOrdersForAdmin(options: {
  status?: string;
  query?: string;
  page?: number;
  pageSize?: number;
} = {}) {
  const filter: Filter<OrderDoc> = {};
  const statuses: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (options.status && statuses.includes(options.status as OrderStatus)) {
    filter.status = options.status as OrderStatus;
  }

  if (options.query?.trim()) {
    const regex = new RegExp(
      options.query.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    filter.$or = [{ orderNumber: regex }, { customerEmail: regex }];
  }

  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));
  const [total, orders] = await Promise.all([
    ordersCollection.countDocuments(filter),
    ordersCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .toArray(),
  ]);

  return {
    orders: orders.map(serializeOrderSummary),
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    page,
    pageSize,
  };
}

export async function updateOrderStatus(
  orderId: string,
  statusValue: unknown,
  adminUserId: string | null = null,
): Promise<Order> {
  const statuses: OrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
  ];

  if (typeof statusValue !== "string" || !statuses.includes(statusValue as OrderStatus)) {
    throw new ValidationError("Order status is not valid.");
  }

  const nextStatus = statusValue as OrderStatus;
  const id = parseObjectId(orderId, "Order ID");
  const existing = await ordersCollection.findOne({ _id: id });

  if (!existing) {
    throw notFound("Order not found.");
  }

  if (existing.status === nextStatus) {
    // A previous cancellation may have claimed the order and then failed
    // before restoring inventory. Retrying the same request resumes it.
    if (nextStatus === "cancelled") {
      if (existing.inventoryState === "released") {
        return serializeOrder(existing);
      }

      if (existing.inventoryState === "releasing") {
        return serializeOrder(await resumeReleasingOrder(existing._id));
      }

      if (
        existing.inventoryState === "reserving" ||
        existing.inventoryState === "reserved"
      ) {
        return cancelOrder(existing, adminUserId);
      }
    }

    return serializeOrder(existing);
  }

  // Only a fully reserved order may be fulfilled. `reserving`, `releasing`,
  // and `released` are all non-fulfillable states.
  if (nextStatus !== "cancelled" && existing.inventoryState !== "reserved") {
    throw conflict(ORDER_NOT_RESERVED_MESSAGE);
  }

  if (!ORDER_STATUS_TRANSITIONS[existing.status].includes(nextStatus)) {
    throw new ValidationError(
      `Order cannot move from ${existing.status} to ${nextStatus}.`,
    );
  }

  if (nextStatus === "cancelled") {
    return cancelOrder(existing, adminUserId);
  }

  const updatedAt = new Date();
  const event: OrderStatusEventDoc = {
    status: nextStatus,
    changedAt: updatedAt,
    changedByAdminId: adminUserId,
  };
  const updated = await ordersCollection.findOneAndUpdate(
    {
      _id: id,
      status: existing.status,
      inventoryState: "reserved",
    },
    {
      $set: { status: nextStatus, updatedAt },
      $push: { statusHistory: event },
    },
    { returnDocument: "after" },
  );

  if (!updated) {
    const current = await ordersCollection.findOne({ _id: id });

    if (!current) {
      throw notFound("Order not found.");
    }

    if (current.inventoryState !== "reserved") {
      throw conflict(ORDER_NOT_RESERVED_MESSAGE);
    }

    throw conflict(
      "This order was updated by another request. Refresh the page and try again.",
    );
  }

  return serializeOrder(updated);
}

/**
 * Resumes a release that a previous worker claimed but did not finish. If a
 * live worker still owns the claim this returns the current (releasing) order
 * instead of starting a second restoration pass.
 */
async function resumeReleasingOrder(orderId: ObjectId): Promise<OrderDoc> {
  const claimed = await claimReleasingOrder(orderId);

  if (!claimed) {
    const current = await ordersCollection.findOne({ _id: orderId });

    if (!current) {
      throw notFound("Order not found.");
    }

    return current;
  }

  return finishInventoryRelease(claimed.order, claimed.token);
}

async function cancelOrder(
  order: OrderDoc,
  adminUserId: string | null,
): Promise<Order> {
  // Repeated cancellation is idempotent.
  if (order.inventoryState === "released") {
    return serializeOrder(order);
  }

  if (order.inventoryState === "releasing") {
    return serializeOrder(await resumeReleasingOrder(order._id));
  }

  const now = new Date();
  const token = new ObjectId().toHexString();
  const event: OrderStatusEventDoc = {
    status: "cancelled",
    changedAt: now,
    changedByAdminId: adminUserId,
  };

  return runOptionalTransaction(async (session) => {
    if (order.inventoryState === "reserving") {
      // Do not tear down a reservation while its owner is still applying
      // effects. Only a stale claim may be taken over.
      const claimed = await ordersCollection.findOneAndUpdate(
        {
          _id: order._id,
          status: order.status,
          inventoryState: "reserving",
          ...staleClaimFilter(now.getTime()),
        },
        {
          $set: {
            status: "cancelled",
            inventoryState: "releasing",
            inventoryClaim: { token, at: now },
            lastRecoveryAt: now,
            updatedAt: now,
          },
          $push: { statusHistory: event },
        },
        { session, returnDocument: "after" },
      );

      if (!claimed) {
        const current = await ordersCollection.findOne({ _id: order._id }, { session });

        if (!current) {
          throw notFound("Order not found.");
        }

        if (current.inventoryState === "released") {
          return serializeOrder(current);
        }

        if (current.inventoryState === "releasing") {
          return serializeOrder(await resumeReleasingOrder(current._id));
        }

        throw conflict(
          "This checkout is still reserving inventory. Wait a moment and try again.",
        );
      }

      return serializeOrder(await finishInventoryRelease(claimed, token, session));
    }

    const claimed = await ordersCollection.findOneAndUpdate(
      {
        _id: order._id,
        status: order.status,
        inventoryState: "reserved",
      },
      {
        $set: {
          status: "cancelled",
          inventoryState: "releasing",
          inventoryClaim: { token, at: now },
          lastRecoveryAt: now,
          updatedAt: now,
        },
        $push: { statusHistory: event },
      },
      { session, returnDocument: "after" },
    );

    if (!claimed) {
      const current = await ordersCollection.findOne({ _id: order._id }, { session });

      if (!current) {
        throw notFound("Order not found.");
      }

      if (current.inventoryState === "released") {
        return serializeOrder(current);
      }

      if (current.inventoryState === "releasing") {
        return serializeOrder(await resumeReleasingOrder(current._id));
      }

      throw conflict(
        "This order changed or its inventory was already released. Refresh and try again.",
      );
    }

    return serializeOrder(await finishInventoryRelease(claimed, token, session));
  });
}

export async function assertOrderOwnership(
  userId: string,
  orderId: string,
) {
  const order = await ordersCollection.findOne({
    _id: parseObjectId(orderId, "Order ID"),
  });

  if (!order) {
    throw notFound("Order not found.");
  }

  if (order.userId !== userId) {
    throw forbidden("You do not have access to this order.");
  }

  return order;
}

export async function readCheckoutPreview(userId: string, code: string) {
  const { subtotalCents } = await loadCheckoutLines(userId);
  const preview = await validateCoupon(code, subtotalCents);
  const shippingCents =
    subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FEE_CENTS;

  return {
    subtotalCents,
    discountCents: preview.discountCents,
    shippingCents,
    totalCents: Math.max(0, subtotalCents - preview.discountCents + shippingCents),
    coupon: preview.coupon,
  };
}

export function parseAdminOrderQuery(params: URLSearchParams) {
  const status = params.get("status") ?? "";
  const query = params.get("q") ?? "";
  const page = Number(params.get("page") ?? "1");
  const pageSize = Number(params.get("pageSize") ?? "20");

  return {
    status: status || undefined,
    query: query || undefined,
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
    pageSize: Number.isSafeInteger(pageSize) && pageSize > 0 ? pageSize : 20,
  };
}

/**
 * Safely resolves an order that encountered a permanent inventory reconciliation failure
 * (e.g. a deleted product/coupon). Admins can retry after repairing the data or force-release
 * with a durable audit trail.
 */
export async function resolveOrderReconciliation(
  orderId: string,
  admin: CurrentUser,
  action: "retry" | "force-release",
): Promise<Order> {
  if (admin.role !== "admin") {
    throw forbidden("Administrator access is required.");
  }

  const id = parseObjectId(orderId, "Order ID");
  const order = await ordersCollection.findOne({ _id: id });

  if (!order) {
    throw notFound("Order not found.");
  }

  const now = new Date();

  if (action === "retry") {
    const updated = await ordersCollection.findOneAndUpdate(
      { _id: id },
      {
        $set: {
          recoveryAttempts: 0,
          reconciliationRequired: false,
          reconciliationError: null,
          updatedAt: now,
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      throw conflict("Order could not be updated.");
    }

    if (updated.inventoryState === "releasing") {
      await recoverReleasingOrder(updated._id).catch(() => null);
    } else if (updated.inventoryState === "reserving") {
      await recoverReservingOrder(updated._id).catch(() => null);
    }

    const after = await ordersCollection.findOne({ _id: id });
    return serializeOrder(after ?? updated);
  }

  if (action === "force-release") {
    const token = new ObjectId().toHexString();
    const claimed = await ordersCollection.findOneAndUpdate(
      {
        _id: id,
        reconciliationRequired: true,
        inventoryState: { $in: ["reserving", "releasing"] },
        ...staleClaimFilter(now.getTime()),
      },
      {
        $set: {
          inventoryState: "releasing",
          inventoryClaim: { token, at: now },
          lastRecoveryAt: now,
          updatedAt: now,
        },
        $push: {
          statusHistory: {
            status: order.status,
            changedAt: now,
            changedByAdminId: admin.id,
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!claimed) {
      throw conflict(
        "Order could not be force-released while another recovery worker owns it. Retry after the active recovery finishes.",
      );
    }

    const options: ReleaseOptions = {
      requireReservation: Boolean(claimed.checkout),
      allowUnreserved: true,
    };

    try {
      // Force release still fences every surviving inventory document. Missing
      // documents cannot accept a late write, while existing documents are
      // atomically restored or marked as having had no reservation.
      for (const item of claimed.items) {
        const product = await productsCollection.findOne(
          { _id: item.productId },
          { projection: { _id: 1 } },
        );

        if (product) {
          await restoreProductStock(claimed._id, item, options);
        }
      }

      if (claimed.couponId) {
        const coupon = await couponsCollection.findOne(
          { _id: claimed.couponId },
          { projection: { _id: 1 } },
        );

        if (coupon) {
          await restoreCouponUse(claimed._id, claimed.couponId, options);
        }
      }

      await releaseCheckoutCategories(claimed);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await ordersCollection.updateOne(
        {
          _id: claimed._id,
          inventoryState: "releasing",
          "inventoryClaim.token": token,
        },
        {
          $set: {
            reconciliationRequired: true,
            reconciliationError: message,
            lastRecoveryAt: new Date(),
          },
          $unset: { inventoryClaim: "" },
        },
      );
      throw error;
    }

    const resolvedAt = new Date();
    const updated = await ordersCollection.findOneAndUpdate(
      {
        _id: claimed._id,
        inventoryState: "releasing",
        "inventoryClaim.token": token,
      },
      {
        $set: {
          inventoryState: "released",
          inventoryClaim: null,
          reconciliationRequired: false,
          reconciliationError: null,
          reconciliationResolvedAt: resolvedAt,
          reconciliationResolvedByAdminId: admin.id,
          updatedAt: resolvedAt,
        },
        $push: {
          statusHistory: {
            status: claimed.status,
            changedAt: resolvedAt,
            changedByAdminId: admin.id,
          },
        },
      },
      { returnDocument: "after" },
    );

    if (!updated) {
      throw releaseFailed(
        "Inventory was fenced, but the admin resolution could not be finalized. Recovery remains queued.",
      );
    }

    return serializeOrder(updated);
  }

  throw new ValidationError("Invalid reconciliation action.");
}
