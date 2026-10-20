import type {
  OrderStatus,
  ProductBadge,
  ProductIconName,
  SortOption,
} from "@/lib/types";

export const MAX_QUANTITY = 99;
export const FREE_SHIPPING_THRESHOLD_CENTS = 7_500;
export const SHIPPING_FEE_CENTS = 599;
/**
 * Active products at or below this quantity appear in admin low-stock alerts.
 * This is intentionally a single shared constant so the dashboard, inventory
 * filter, and stat cards cannot drift apart.
 */
export const LOW_STOCK_THRESHOLD = 5;
export const PRODUCTS_PER_PAGE = 12;
export const ADMIN_PRODUCTS_PER_PAGE = 20;
export const ADMIN_ORDERS_PER_PAGE = 20;

export const SORT_OPTIONS: readonly {
  value: SortOption;
  label: string;
}[] = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "rating-desc", label: "Highest rated" },
  { value: "name-asc", label: "Name: A to Z" },
];

export const PRODUCT_BADGES: readonly {
  value: ProductBadge;
  label: string;
}[] = [
  { value: "bestseller", label: "Bestseller" },
  { value: "new", label: "New arrival" },
  { value: "limited", label: "Limited edition" },
];

export const PRODUCT_ICONS: readonly {
  value: ProductIconName;
  label: string;
}[] = [
  { value: "headphones", label: "Headphones" },
  { value: "speaker", label: "Speaker" },
  { value: "lamp", label: "Lamp" },
  { value: "keyboard", label: "Keyboard" },
  { value: "mug", label: "Mug" },
  { value: "throw", label: "Throw" },
  { value: "backpack", label: "Backpack" },
  { value: "watch", label: "Watch" },
  { value: "sneaker", label: "Sneaker" },
  { value: "bottle", label: "Bottle" },
  { value: "diffuser", label: "Diffuser" },
  { value: "yoga-mat", label: "Yoga mat" },
];

export const ORDER_STATUSES: readonly {
  value: OrderStatus;
  label: string;
}[] = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
