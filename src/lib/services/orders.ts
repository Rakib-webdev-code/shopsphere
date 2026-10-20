import { randomBytes } from "node:crypto";
import {
  MongoServerError,
  ObjectId,
  type ClientSession,
  type Filter,
} from "mongodb";
import {
  cartsCollection,
  couponsCollection,
  ordersCollection,
  productsCollection,
} from "@/lib/db/collections";
import type {
  OrderDoc,
  OrderItemDoc,
  OrderStatusEventDoc,
  ProductDoc,
  ShippingAddressDoc,
} from "@/lib/db/types";
import {
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
import { getCartDocument } from "@/lib/services/cart";
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

function isDuplicateKeyError(error: unknown) {
  return error instanceof MongoServerError && error.code === 11000;
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

async function loadCheckoutLines(userId: string): Promise<{
  lines: CheckoutLine[];
  cartItems: { productId: ObjectId; quantity: number }[];
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
  const lines: CheckoutLine[] = [];

  for (const cartItem of cart.items) {
    const product = productMap.get(cartItem.productId.toHexString());

    if (!product || !product.active) {
      throw conflict(
        `${product?.name ?? "An item"} is no longer available. Remove it from your cart to continue.`,
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
    cartItems: cart.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    })),
    subtotalCents: lines.reduce((total, line) => total + line.lineTotalCents, 0),
  };
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

async function reserveStock(
  lines: CheckoutLine[],
  session?: ClientSession,
) {
  for (const line of lines) {
    const result = await productsCollection.updateOne(
      {
        _id: line.product._id,
        active: true,
        stock: { $gte: line.quantity },
      },
      { $inc: { stock: -line.quantity }, $set: { updatedAt: new Date() } },
      { session },
    );

    if (result.modifiedCount !== 1) {
      throw conflict(
        `${line.product.name} no longer has enough stock. Refresh your cart and try again.`,
      );
    }
  }
}

async function reserveCoupon(
  coupon: Coupon | null,
  subtotalCents: number,
  session?: ClientSession,
) {
  if (!coupon) {
    return;
  }

  const couponId = parseObjectId(coupon.id, "Coupon ID");
  const current = await couponsCollection.findOne(
    { _id: couponId },
    { session },
  );

  if (!current) {
    throw new ValidationError("Coupon code was not found.");
  }

  assertCouponEligible(current, subtotalCents);

  const result = await couponsCollection.updateOne(
    { _id: couponId, usedCount: current.usedCount },
    { $inc: { usedCount: 1 }, $set: { updatedAt: new Date() } },
    { session },
  );

  if (result.modifiedCount !== 1) {
    throw conflict("That coupon was just used by another order. Try again.");
  }
}

export async function createOrder(
  user: CurrentUser,
  raw: unknown,
): Promise<Order> {
  const body = asRecord(raw);
  const checkoutKey = readOptionalString(body.checkoutKey, {
    label: "Checkout key",
    min: 16,
    max: 80,
    pattern: /^[A-Za-z0-9_-]+$/,
    patternMessage: "Checkout key is not valid.",
  });

  if (checkoutKey) {
    const existing = await findOrderByCheckoutKey(user.id, checkoutKey);

    if (existing) {
      return serializeOrder(existing);
    }
  }

  const shippingAddress = await resolveShippingAddress(user.id, body);
  const { lines, subtotalCents } = await loadCheckoutLines(user.id);
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
  const items: OrderItemDoc[] = lines.map((line) => ({
    productId: line.product._id,
    name: line.product.name,
    slug: line.product.slug,
    image: line.product.images?.[0] ?? null,
    priceInCents: line.product.priceInCents,
    quantity: line.quantity,
    lineTotalCents: line.lineTotalCents,
  }));
  const order: OrderDoc = {
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
    inventoryState: "reserved",
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
    return createOrderWithCompensation(user, order, lines, subtotalCents, couponPreview);
  }

  try {
    return await runOptionalTransaction(async (session) => {
      await reserveStock(lines, session);
      await reserveCoupon(couponPreview?.coupon ?? null, subtotalCents, session);
      await ordersCollection.insertOne(order, { session });
      await cartsCollection.updateOne(
        { userId: user.id },
        { $set: { items: [], updatedAt: new Date() } },
        { session },
      );
      return serializeOrder(order);
    });
  } catch (error) {
    // Two retries with the same key can both get past the initial lookup.
    // The partial unique index decides the winner; the loser returns the
    // already-created order instead of reporting a second checkout.
    if (checkoutKey && isDuplicateKeyError(error)) {
      const existing = await findOrderByCheckoutKey(user.id, checkoutKey);

      if (existing) {
        return serializeOrder(existing);
      }
    }

    throw error;
  }
}

async function createOrderWithCompensation(
  user: CurrentUser,
  order: OrderDoc,
  lines: CheckoutLine[],
  subtotalCents: number,
  couponPreview: Awaited<ReturnType<typeof validateCoupon>> | null,
) {
  const stockReservations: CheckoutLine[] = [];
  let couponReserved = false;

  try {
    for (const line of lines) {
      const result = await productsCollection.updateOne(
        {
          _id: line.product._id,
          active: true,
          stock: { $gte: line.quantity },
        },
        { $inc: { stock: -line.quantity }, $set: { updatedAt: new Date() } },
      );

      if (result.modifiedCount !== 1) {
        throw conflict(
          `${line.product.name} no longer has enough stock. Refresh your cart and try again.`,
        );
      }

      stockReservations.push(line);
    }

    if (couponPreview) {
      await reserveCoupon(couponPreview.coupon, subtotalCents);
      couponReserved = true;
    }

    await ordersCollection.insertOne(order);
  } catch (error) {
    await releaseReservations(stockReservations, couponReserved ? order.couponId : null);

    if (order.checkoutKey && isDuplicateKeyError(error)) {
      const existing = await findOrderByCheckoutKey(
        user.id,
        order.checkoutKey,
      );

      if (existing) {
        return serializeOrder(existing);
      }
    }

    throw error;
  }

  try {
    await cartsCollection.updateOne(
      { userId: user.id },
      { $set: { items: [], updatedAt: new Date() } },
    );
  } catch (error) {
    // The order was already created. Do not delete it; log for follow-up.
    console.error("[orders] Order created but cart could not be cleared:", error);
  }

  return serializeOrder(order);
}

async function releaseReservations(
  lines: CheckoutLine[],
  couponId: ObjectId | null,
) {
  for (const line of lines) {
    try {
      await productsCollection.updateOne(
        { _id: line.product._id },
        { $inc: { stock: line.quantity }, $set: { updatedAt: new Date() } },
      );
    } catch (error) {
      console.error("[orders] Failed to restore stock after checkout error:", error);
    }
  }

  if (couponId) {
    try {
      await couponsCollection.updateOne(
        { _id: couponId, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
      );
    } catch (error) {
      console.error("[orders] Failed to restore coupon usage:", error);
    }
  }
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
    return serializeOrder(existing);
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
    { _id: id, status: existing.status },
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

    throw conflict(
      "This order was updated by another request. Refresh the page and try again.",
    );
  }

  return serializeOrder(updated);
}

async function cancelOrder(
  order: OrderDoc,
  adminUserId: string | null,
): Promise<Order> {
  if (order.inventoryState === "released") {
    throw conflict("This order's inventory has already been released.");
  }

  const updatedAt = new Date();
  const event: OrderStatusEventDoc = {
    status: "cancelled",
    changedAt: updatedAt,
    changedByAdminId: adminUserId,
  };
  const cancellationUpdate = {
    $set: {
      status: "cancelled" as const,
      inventoryState: "released" as const,
      updatedAt,
    },
    $push: { statusHistory: event },
  };
  const releasedMessage =
    "This order's inventory has already been released or is being updated. Refresh and try again.";

  if (!(await supportsTransactions())) {
    // Claim the release first. Only one concurrent request can match
    // `inventoryState: "reserved"`, so stock cannot be restored twice.
    const claimed = await ordersCollection.findOneAndUpdate(
      { _id: order._id, inventoryState: "reserved" },
      cancellationUpdate,
      { returnDocument: "after" },
    );

    if (!claimed) {
      throw conflict(releasedMessage);
    }

    for (const item of claimed.items) {
      try {
        await productsCollection.updateOne(
          { _id: item.productId },
          { $inc: { stock: item.quantity }, $set: { updatedAt: new Date() } },
        );
      } catch (error) {
        console.error("[orders] Failed to restore stock after cancellation:", error);
      }
    }

    if (claimed.couponId) {
      try {
        await couponsCollection.updateOne(
          { _id: claimed.couponId, usedCount: { $gt: 0 } },
          { $inc: { usedCount: -1 } },
        );
      } catch (error) {
        console.error("[orders] Failed to restore coupon usage:", error);
      }
    }

    return serializeOrder(claimed);
  }

  return runOptionalTransaction(async (session) => {
    const current = await ordersCollection.findOne(
      { _id: order._id },
      { session },
    );

    if (!current) {
      throw notFound("Order not found.");
    }

    if (current.inventoryState === "released") {
      throw conflict("This order's inventory has already been released.");
    }

    const claimed = await ordersCollection.findOneAndUpdate(
      { _id: current._id, inventoryState: "reserved" },
      cancellationUpdate,
      { session, returnDocument: "after" },
    );

    if (!claimed) {
      throw conflict(releasedMessage);
    }

    for (const item of claimed.items) {
      await productsCollection.updateOne(
        { _id: item.productId },
        { $inc: { stock: item.quantity }, $set: { updatedAt: new Date() } },
        { session },
      );
    }

    if (claimed.couponId) {
      await couponsCollection.updateOne(
        { _id: claimed.couponId, usedCount: { $gt: 0 } },
        { $inc: { usedCount: -1 } },
        { session },
      );
    }

    return serializeOrder(claimed);
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
