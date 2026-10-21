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
  createdAt: Date;
  updatedAt: Date;
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
   * Idempotency markers for cancelled orders whose stock has already been
   * restored. A marker is written in the same atomic update as the `$inc`, so
   * retrying a release (or recovering after a crash) can never add stock twice.
   * The list is capped by the order service to keep product documents bounded.
   */
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
   * `reserved` holds stock for the order. Cancellation first claims the order
   * as `releasing`, then restores inventory idempotently, and only marks it
   * `released` once every item and the coupon have been restored. A crash in
   * between leaves `releasing`, which the recovery path can safely resume.
   */
  inventoryState: "reserved" | "releasing" | "released";
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
   * Same idempotency mechanism as `ProductDoc.inventoryRestorations`, keyed by
   * the cancelled order. Prevents a retried cancellation from decrementing
   * `usedCount` twice.
   */
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
