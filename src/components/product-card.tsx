import Link from "next/link";
import { ProductMedia } from "@/components/product-media";
import { Rating } from "@/components/rating";
import { formatPrice } from "@/lib/format";
import type { Product, ProductBadge } from "@/lib/types";

type ProductCardProps = {
  product: Product;
};

const badgeLabels: Record<ProductBadge, string> = {
  bestseller: "Bestseller",
  new: "New",
  limited: "Limited",
};

const badgeClasses: Record<ProductBadge, string> = {
  bestseller: "bg-strong text-strong-foreground",
  new: "bg-accent-solid text-white",
  limited: "bg-surface/90 text-foreground ring-1 ring-border",
};

export function ProductCard({ product }: ProductCardProps) {
  const isOnSale = product.compareAtPriceInCents !== null;
  const stockTone = !product.inStock
    ? "bg-faint"
    : product.stock <= 5
      ? "bg-warning"
      : "bg-accent-bright";

  return (
    <article className="group h-full">
      <Link
        href={`/shop/${product.slug}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-xl hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:hover:shadow-black/40"
      >
        <div className="relative overflow-hidden p-2">
          <ProductMedia
            product={product}
            className="aspect-square rounded-xl transition-transform duration-500 ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
            {product.badge && (
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm ${badgeClasses[product.badge]}`}
              >
                {badgeLabels[product.badge]}
              </span>
            )}
            {isOnSale && (
              <span className="rounded-full bg-surface/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-sm ring-1 ring-border backdrop-blur">
                Sale
              </span>
            )}
            {!product.inStock && (
              <span className="rounded-full bg-strong/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-strong-foreground shadow-sm">
                Sold out
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col px-5 pb-5 pt-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            {product.category?.name ?? "ShopSphere"}
          </p>
          <h3 className="mt-1.5 text-base font-semibold tracking-tight text-foreground transition-colors group-hover:text-accent">
            {product.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">
            {product.summary}
          </p>

          <div className="mt-3">
            <Rating rating={product.rating} reviewCount={product.reviewCount} />
          </div>

          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div>
              <p className="text-lg font-bold text-foreground">
                {formatPrice(product.priceInCents)}
              </p>
              {product.compareAtPriceInCents !== null && (
                <p className="text-sm text-faint line-through">
                  {formatPrice(product.compareAtPriceInCents)}
                </p>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-soft">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 rounded-full ${stockTone}`}
              />
              {product.inStock
                ? product.stock <= 5
                  ? `Only ${product.stock} left`
                  : "In stock"
                : "Out of stock"}
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
