export type UserRole = "customer" | "admin";

export type ProductBadge = "bestseller" | "new" | "limited";

export type ProductIconName =
  | "headphones"
  | "speaker"
  | "lamp"
  | "keyboard"
  | "mug"
  | "throw"
  | "backpack"
  | "watch"
  | "sneaker"
  | "bottle"
  | "diffuser"
  | "yoga-mat";

export type SortOption =
  | "featured"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "rating-desc"
  | "name-asc";

export type CategoryRef = {
  id: string;
  name: string;
  slug: string;
  icon: ProductIconName;
};

export type Category = CategoryRef & {
  tagline: string;
  description: string;
  icon: ProductIconName;
  imageUrl: string | null;
  active: boolean;
  productCount: number;
  createdAt: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  sku: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  priceInCents: number;
  compareAtPriceInCents: number | null;
  category: CategoryRef | null;
  images: string[];
  stock: number;
  inStock: boolean;
  badge: ProductBadge | null;
  featured: boolean;
  active: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ProductFilters = {
  query: string;
  category: string;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  sort: SortOption;
  page: number;
  pageSize: number;
};

export type ProductListResult = {
  products: Product[];
  filters: ProductFilters;
  total: number;
  totalPages: number;
};

export type CartItem = {
  productId: string;
  slug: string;
  name: string;
  image: string | null;
  priceInCents: number;
  quantity: number;
  stock: number;
  active: boolean;
  lineTotalCents: number;
};

export type Cart = {
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
  hasUnavailableItems: boolean;
  updatedAt: string | null;
};

export type Wishlist = {
  products: Product[];
};

export type Address = {
  id: string;
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
  createdAt: string;
  updatedAt: string;
};

export type AddressInput = {
  label?: string;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
  isDefault?: boolean;
};

export type Profile = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
};

export type CouponType = "percentage" | "fixed";

export type Coupon = {
  id: string;
  code: string;
  description: string;
  type: CouponType;
  value: number;
  minSubtotalCents: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CouponPreview = {
  coupon: Coupon;
  discountCents: number;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type PaymentStatus = "unpaid";

export type OrderStatusEvent = {
  status: OrderStatus;
  changedAt: string;
};

export type OrderItem = {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
  priceInCents: number;
  quantity: number;
  lineTotalCents: number;
};

export type ShippingAddress = {
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

export type Order = {
  id: string;
  orderNumber: string;
  userId: string;
  customerEmail: string;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  couponCode: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  inventoryState: "reserved" | "released";
  statusHistory: OrderStatusEvent[];
  createdAt: string;
  updatedAt: string;
};

export type OrderSummary = {
  id: string;
  orderNumber: string;
  customerEmail: string;
  itemCount: number;
  totalCents: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
};

export type Review = {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  title: string;
  body: string;
  verifiedPurchase: boolean;
  isOwn: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  orderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  createdAt: string;
};

export type AdminStats = {
  activeProducts: number;
  inactiveProducts: number;
  activeCategories: number;
  lowStockProducts: number;
  totalOrders: number;
  openOrders: number;
  cancelledOrders: number;
  grossOrderValueCents: number;
  customerCount: number;
  recentOrders: OrderSummary[];
};

export type LowStockProduct = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  active: boolean;
};

export type LowStockOverview = {
  threshold: number;
  total: number;
  outOfStock: number;
  items: LowStockProduct[];
};
