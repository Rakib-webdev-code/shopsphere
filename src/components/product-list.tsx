import Link from "next/link";
import { ArrowRightIcon, PackageIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import type { Product } from "@/lib/types";

type ColumnCount = 3 | 4;

type ProductListProps = {
  products: readonly Product[];
  columns?: ColumnCount;
  emptyTitle?: string;
  emptyDescription?: string;
};

const gridClasses: Record<ColumnCount, string> = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

export function ProductList({
  products,
  columns = 4,
  emptyTitle = "No products found",
  emptyDescription = "Try a different search term or browse the full catalog.",
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full bg-surface text-muted-soft shadow-sm ring-1 ring-border">
          <PackageIcon className="h-6 w-6" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-foreground">
          {emptyTitle}
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          {emptyDescription}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Browse all products
            <ArrowRightIcon />
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Explore categories
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul
      role="list"
      className={`grid grid-cols-1 gap-5 ${gridClasses[columns]}`}
    >
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} />
        </li>
      ))}
    </ul>
  );
}

type ProductGridSkeletonProps = {
  count?: number;
  columns?: ColumnCount;
};

export function ProductGridSkeleton({
  count = 8,
  columns = 4,
}: ProductGridSkeletonProps) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading products...</span>
      <ul
        aria-hidden="true"
        className={`grid grid-cols-1 gap-5 ${gridClasses[columns]}`}
      >
        {Array.from({ length: count }, (_, index) => (
          <li
            key={index}
            className="overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <div className="p-2">
              <div className="aspect-square animate-pulse rounded-xl bg-surface-subtle" />
            </div>
            <div className="space-y-3 p-5 pt-3">
              <div className="h-3 w-20 animate-pulse rounded-full bg-surface-subtle" />
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-surface-subtle" />
              <div className="h-4 w-full animate-pulse rounded-full bg-surface-subtle" />
              <div className="flex justify-between gap-4 pt-2">
                <div className="h-5 w-20 animate-pulse rounded-full bg-surface-subtle" />
                <div className="h-4 w-16 animate-pulse rounded-full bg-surface-subtle" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
