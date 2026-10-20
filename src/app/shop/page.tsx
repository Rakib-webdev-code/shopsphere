import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import {
  ProductGridSkeleton,
  ProductList,
} from "@/components/product-list";
import { StorefrontSearch } from "@/components/storefront-search";
import { StorefrontShell } from "@/components/storefront-shell";
import { Alert, Pagination, inputClass } from "@/components/ui";
import { SORT_OPTIONS } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { listCategories } from "@/lib/services/categories";
import {
  listProducts,
  normalizeProductFilters,
} from "@/lib/services/products";
import type { ProductFilters } from "@/lib/types";

export const metadata: Metadata = {
  title: "Shop the collection",
  description:
    "Browse the ShopSphere catalog with server-side search, category filters, price filters, sorting, and pagination.",
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

type ShopHrefInput = {
  filters?: Partial<ProductFilters>;
  query?: string;
  category?: string;
};

function shopHref({ filters, query, category }: ShopHrefInput) {
  const params = new URLSearchParams();
  const q = query ?? filters?.query;
  const activeCategory = category ?? filters?.category;

  if (q) params.set("q", q);
  if (activeCategory) params.set("category", activeCategory);
  if (filters?.minPriceCents != null) {
    params.set("minPrice", (filters.minPriceCents / 100).toFixed(2));
  }
  if (filters?.maxPriceCents != null) {
    params.set("maxPrice", (filters.maxPriceCents / 100).toFixed(2));
  }
  if (filters?.sort && filters.sort !== "featured") {
    params.set("sort", filters.sort);
  }

  const search = params.toString();
  return search ? `/shop?${search}` : "/shop";
}

export default function ShopPage(props: PageProps<"/shop">) {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-soft">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-foreground">
              Shop
            </li>
          </ol>
        </nav>

        <div className="mt-5 flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Shop the collection
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
              Browse the live catalog, or narrow the list by category, price, or
              search term. Every query runs against MongoDB on the server.
            </p>
          </div>
        </div>

        <Suspense fallback={<ShopResultsSkeleton />}>
          <ShopResults searchParams={props.searchParams} />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function ShopResults({
  searchParams,
}: Pick<PageProps<"/shop">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const queryInput = {
    q: firstValue(params.q),
    category: firstValue(params.category),
    minPrice: firstValue(params.minPrice),
    maxPrice: firstValue(params.maxPrice),
    sort: firstValue(params.sort),
    page: firstValue(params.page),
  };

  let filters: ProductFilters;

  try {
    filters = normalizeProductFilters(queryInput);
  } catch (error) {
    return (
      <div className="mt-8">
        <Alert tone="error">
          {error instanceof ApiError
            ? error.message
            : "Those filters are not valid."}{" "}
          <Link href="/shop" className="font-semibold underline">
            Reset filters
          </Link>
        </Alert>
      </div>
    );
  }

  let results;
  let categories;

  try {
    [results, categories] = await Promise.all([
      listProducts(queryInput),
      listCategories(),
    ]);
  } catch (error) {
    return (
      <div className="mt-8">
        <Alert tone="error">
          The catalog could not be loaded.{" "}
          {error instanceof ApiError ? error.message : "Please try again."}
        </Alert>
      </div>
    );
  }

  const categoryInfo = filters.category
    ? categories.find((category) => category.slug === filters.category)
    : undefined;
  const hasFilters =
    Boolean(filters.query) ||
    Boolean(filters.category) ||
    filters.minPriceCents !== null ||
    filters.maxPriceCents !== null;

  const emptyTitle = filters.query
    ? `No matches for “${filters.query}”`
    : categoryInfo
      ? `No products in ${categoryInfo.name} yet`
      : "No products found";

  const emptyDescription = filters.query
    ? "Try a broader search term, or clear the search to browse every product."
    : "Browse the full catalog or try another category or price range.";

  return (
    <section aria-label="Product catalog" className="mt-8">
      <div className="rounded-2xl border border-border bg-surface-muted/70 p-4 sm:p-6">
        <p className="text-sm font-semibold text-foreground">
          Filter the catalog
        </p>
        <div className="mt-3">
          <StorefrontSearch
            defaultValue={filters.query}
            variant="inline"
            className="max-w-2xl"
          />
        </div>

        <nav aria-label="Filter by category" className="mt-5">
          <ul className="flex flex-wrap gap-2">
            <li>
              <FilterChip href={shopHref({ filters, category: "" })} active={!filters.category}>
                All products
              </FilterChip>
            </li>
            {categories.map((category) => (
              <li key={category.id}>
                <FilterChip
                  href={shopHref({ filters, category: category.slug })}
                  active={filters.category === category.slug}
                >
                  {category.name}
                </FilterChip>
              </li>
            ))}
          </ul>
        </nav>

        <form
          action="/shop"
          method="get"
          className="mt-5 grid gap-3 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-[160px_160px_220px_auto]"
        >
          {filters.query && <input type="hidden" name="q" value={filters.query} />}
          {filters.category && (
            <input type="hidden" name="category" value={filters.category} />
          )}
          <div>
            <label htmlFor="minPrice" className="text-xs font-semibold text-muted">
              Min price (USD)
            </label>
            <input
              id="minPrice"
              name="minPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                filters.minPriceCents !== null
                  ? (filters.minPriceCents / 100).toFixed(2)
                  : ""
              }
              placeholder="0.00"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="maxPrice" className="text-xs font-semibold text-muted">
              Max price (USD)
            </label>
            <input
              id="maxPrice"
              name="maxPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={
                filters.maxPriceCents !== null
                  ? (filters.maxPriceCents / 100).toFixed(2)
                  : ""
              }
              placeholder="Any"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sort" className="text-xs font-semibold text-muted">
              Sort by
            </label>
            <select
              id="sort"
              name="sort"
              defaultValue={filters.sort}
              className={inputClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-strong-foreground transition-colors hover:bg-strong/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:w-auto"
            >
              Apply filters
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {categoryInfo
              ? categoryInfo.name
              : filters.query
                ? "Search results"
                : "All products"}
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {results.total} {results.total === 1 ? "product" : "products"}
            {filters.query ? (
              <>
                {" "}
                matching{" "}
                <span className="font-semibold text-foreground">
                  “{filters.query}”
                </span>
              </>
            ) : null}
            {filters.minPriceCents !== null || filters.maxPriceCents !== null ? (
              <>
                {" "}
                between {formatPrice(filters.minPriceCents ?? 0)} and{" "}
                {filters.maxPriceCents !== null
                  ? formatPrice(filters.maxPriceCents)
                  : "any price"}
              </>
            ) : null}
          </p>
          {categoryInfo ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {categoryInfo.description}
            </p>
          ) : null}
        </div>

        {hasFilters && (
          <Link
            href="/shop"
            className="w-fit text-sm font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Clear filters
          </Link>
        )}
      </div>

      <div className="mt-6">
        <ProductList
          products={results.products}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
        />
        <Pagination
          basePath="/shop"
          page={results.filters.page}
          totalPages={results.totalPages}
          params={{
            q: filters.query,
            category: filters.category,
            minPrice:
              filters.minPriceCents !== null
                ? (filters.minPriceCents / 100).toFixed(2)
                : undefined,
            maxPrice:
              filters.maxPriceCents !== null
                ? (filters.maxPriceCents / 100).toFixed(2)
                : undefined,
            sort: filters.sort,
          }}
        />
      </div>
    </section>
  );
}

type FilterChipProps = {
  href: string;
  active: boolean;
  children: ReactNode;
};

function FilterChip({ href, active, children }: FilterChipProps) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
        active
          ? "border-accent-solid bg-accent-solid text-white shadow-sm"
          : "border-border-strong bg-surface text-muted-strong hover:border-border-strong hover:bg-surface-muted"
      }`}
    >
      {children}
    </Link>
  );
}

function ShopResultsSkeleton() {
  return (
    <div className="mt-8">
      <div className="h-44 animate-pulse rounded-2xl border border-border bg-surface-muted" />
      <div className="mt-8 space-y-3">
        <div className="h-7 w-44 animate-pulse rounded-full bg-surface-subtle" />
        <div className="h-4 w-56 animate-pulse rounded-full bg-surface-subtle" />
      </div>
      <div className="mt-6">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  );
}
