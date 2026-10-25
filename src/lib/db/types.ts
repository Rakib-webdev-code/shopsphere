import type { ObjectId } from "mongodb";
import type {
  CouponType,
  OrderStatus,
  PaymentStatus,
  ProductBadge,
  ProductIconName,
  UserRole,
} from "@/lib/types";

export type CategoryDoc = {
  _id: ObjectId;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  icon: ProductIconName;
  imageUrl: string | null;
  active: boolean;
  /** In-flight checkouts hold this marker while validating and reserving stock. */
  checkoutReservations?: { orderId: ObjectId; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
};

export type StockAdjustmentKind = "manual" | "initial";

export type StockAdjustmentDoc = {
  _id: ObjectId;
  productId: ObjectId;
  adminUserId: string;
  kind: StockAdjustmentKind;
  delta: number;
  beforeStock: number;
  afterStock: number;
  reason: string;
  at: Date;
};

export type InventoryState =
  | "reserving"
  | "reserved"
  | "releasing"
  | "released";

/**
 * Durable snapshot of the cart that was validated for a checkout. It is stored
 * on the order before any stock or coupon effect is applied so recovery can
 * finish or abort a checkout without relying on process memory.
 */
export type CheckoutSnapshotDoc = {
  cartId: ObjectId;
  /** `null` means the cart predates the revision field. */
  cartRevision: number | null;
  cartItems: CartItemDoc[];
  /** Categories held active until checkout reaches a durable terminal decision. */
  categoryIds?: ObjectId[];
  startedAt: Date;
};

export type ProductDoc = {
  _id: ObjectId;
  name: string;
  slug: string;
  sku: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  priceInCents: number;
  compareAtPriceInCents: number | null;
  categoryId: ObjectId;
  images: string[];
  stock: number;
  badge: ProductBadge | null;
  featured: boolean;
  active: boolean;
  ratingAverage: number;
  ratingCount: number;
  /**
   * Idempotency evidence for stock effects, written in the same atomic update
   * as the `$inc`. `inventoryReservations` proves that an order's decrement was
   * applied; `inventoryRestorations` proves that the matching increment was
   * applied. Recovery can therefore tell an applied effect from an unapplied
   * (or uncertain) one after an ambiguous acknowledgement or process crash.
   * A restoration marker also fences a late reservation attempt for the same
   * order, even when recovery proves that no decrement had happened yet.
   *
   * These arrays are deliberately never truncated: evicting an entry while a
   * retry is still possible could double-apply stock. A future compaction job
   * may remove entries only once no recovery can ever reference the order.
   */
  inventoryReservations?: { orderId: ObjectId; at: Date }[];
  inventoryRestorations?: { orderId: ObjectId; at: Date }[];
  createdAt: Date;
  updatedAt: Date;
};

export type CartItemDoc = {
  productId: ObjectId;
  quantity: number;
  addedAt: Date;
};

export type CartDoc = {
  _id: ObjectId;
  userId: string;
  items: CartItemDoc[];
  /**
   * Optimistic-concurrency revision. Legacy carts without this field are
   * treated as revision 0 by the cart service.
   */
  revision?: number;
  createdAt: Date;
  updatedAt: Date;
};

export type WishlistDoc = {
  _id: ObjectId;
  userId: string;
  productIds: ObjectId[];
  createdAt: Date;
  updatedAt: Date;
};

export type AddressDoc = {
  _id: ObjectId;
  userId: string;
  label: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type OrderItemDoc = {
  productId: ObjectId;
  name: string;
  slug: string;
  image: string | null;
  priceInCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type ShippingAddressDoc = {
  label: string;
  fullName: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string | null;
};

export type OrderStatusEventDoc = {
  status: OrderStatus;
  changedAt: Date;
  changedByAdminId: string | null;
};

export type OrderDoc = {
  _id: ObjectId;
  orderNumber: string;
  userId: string;
  customerEmail: string;
  items: OrderItemDoc[];
  shippingAddress: ShippingAddressDoc;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponId: ObjectId | null;
  couponCode: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  /**
   * Reservation lifecycle (see `orders.ts` for the full transition table):
   *
   *   reserving -> reserved -> releasing -> released
   *        \__________/          ^
   *              abort ___________|
   *
   * `reserving` is written before any stock/coupon effect. Only `reserved`
   * orders may be fulfilled. `releasing` is an atomic cancellation/recovery
   * claim; `released` is terminal. A crash at any point leaves a durable state
   * that `recoverPendingInventoryReleases` can finish without double effects.
   */
  inventoryState: InventoryState;
  /** Cart snapshot captured before reservations, used for recovery/cleanup. */
  checkout?: CheckoutSnapshotDoc;
  /**
   * Short-lived ownership token for an actor finalizing, aborting, or releasing
   * this order. Workers may take over only after the claim goes stale.
   */
  inventoryClaim?: { token: string; at: Date } | null;
  /** Set when every stock/coupon effect has been applied durably. */
  reservationCompletedAt?: Date | null;
  /** Set once the cart snapshot was conditionally cleared. */
  cartClearedAt?: Date | null;
  categoryReservationsReleasedAt?: Date | null;
  /** Number of recovery attempts, exposed for operator diagnostics. */
  recoveryAttempts?: number;
  lastRecoveryAt?: Date | null;
  /** Durable flag set when inventory restoration failed permanently (e.g. deleted entity). */
  reconciliationRequired?: boolean;
  reconciliationError?: string | null;
  reconciliationResolvedAt?: Date | null;
  reconciliationResolvedByAdminId?: string | null;
  /**
   * Optional so orders created before status history was added remain valid.
   * New orders always receive a pending event, and later transitions append.
   */
  statusHistory?: OrderStatusEventDoc[];
  /**
   * Optional client-generated idempotency key used to make retried checkouts
   * safe. Older orders do not have this field.
   */
  checkoutKey?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ReviewDoc = {
  _id: ObjectId;
  productId: ObjectId;
  userId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  orderId: ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CouponDoc = {
  _id: ObjectId;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  /**
   * Same atomic idempotency mechanism as `ProductDoc`. `couponReservations`
   * proves the order incremented `usedCount`; `couponRestorations` proves the
   * matching decrement was applied. A restoration marker also fences a late
   * reservation attempt. Never truncated for the same reason.
   */
  couponReservations?: { orderId: ObjectId; at: Date }[];
  couponRestorations?: { orderId: ObjectId; at: Date }[];
  expiresAt: Date | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type UserDoc = {
  _id: ObjectId;
  name: string;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: UserRole;
  phone?: string | null;
  createdAt: Date;
  updatedAt: Date;
};
