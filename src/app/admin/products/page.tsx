import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProductMedia } from "@/components/product-media";
import { Alert, Pagination, inputClass, primaryButtonClass } from "@/components/ui";
import { ADMIN_PRODUCTS_PER_PAGE, SORT_OPTIONS } from "@/lib/constants";
import { ApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { listCategories } from "@/lib/services/categories";
import { listProducts } from "@/lib/services/products";

export const metadata: Metadata = { title: "Products" };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminProductsPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<ProductsSkeleton />}>
      <ProductsContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function ProductsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const q = firstValue(params.q) ?? "";
  const category = firstValue(params.category) ?? "";
  const sort = firstValue(params.sort) ?? "newest";
  const page = firstValue(params.page) ?? "1";

  let result;
  let categories;

  try {
    [result, categories] = await Promise.all([
      listProducts({
        q,
        category,
        sort,
        page,
        pageSize: String(ADMIN_PRODUCTS_PER_PAGE),
        includeInactive: true,
      }),
      listCategories({ includeInactive: true }),
    ]);
  } catch (error) {
    return (
      <Alert tone="error">
        Products could not be loaded.{" "}
        {error instanceof ApiError ? error.message : "Please try again."}
      </Alert>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Products
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {result.total} {result.total === 1 ? "product" : "products"} in the
            catalog, including inactive entries.
          </p>
        </div>
        <Link href="/admin/products/new" className={primaryButtonClass}>
          Add product
        </Link>
      </div>

      <form
        action="/admin/products"
        method="get"
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_200px_200px_auto]"
      >
        <div>
          <label htmlFor="product-query" className="text-xs font-semibold text-muted">
            Search
          </label>
          <input
            id="product-query"
            name="q"
            defaultValue={q}
            placeholder="Name, SKU, or tag"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="product-category" className="text-xs font-semibold text-muted">
            Category
          </label>
          <select
            id="product-category"
            name="category"
            defaultValue={category}
            className={inputClass}
          >
            <option value="">All categories</option>
            {categories.map((entry) => (
              <option key={entry.id} value={entry.slug}>
                {entry.name}
                {entry.active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="product-sort" className="text-xs font-semibold text-muted">
            Sort
          </label>
          <select id="product-sort" name="sort" defaultValue={sort} className={inputClass}>
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
            className="w-full rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-strong-foreground transition-colors hover:bg-strong/90 sm:w-auto"
          >
            Filter
          </button>
        </div>
      </form>

      {result.products.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">No products found</p>
          <p className="mt-2 text-sm text-muted">
            Clear the filters or add a new product.
          </p>
          <Link href="/admin/products" className="mt-4 inline-flex text-sm font-semibold text-accent underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Product</th>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Price</th>
                <th className="px-4 py-3 font-semibold">Stock</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Rating</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.products.map((product) => (
                <tr key={product.id} className="transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <ProductMedia
                        product={product}
                        variant="thumb"
                        className="h-12 w-12 shrink-0 rounded-xl"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">
                          {product.name}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-soft">
                          {product.sku}
                          {product.featured ? " · Featured" : ""}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {product.category?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">
                      {formatPrice(product.priceInCents)}
                    </p>
                    {product.compareAtPriceInCents !== null && (
                      <p className="text-xs text-faint line-through">
                        {formatPrice(product.compareAtPriceInCents)}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        product.stock <= 5
                          ? "font-semibold text-warning"
                          : "text-muted-strong"
                      }
                    >
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        product.active
                          ? "bg-accent-soft text-accent-strong ring-accent-border"
                          : "bg-surface-subtle text-muted ring-border"
                      }`}
                    >
                      {product.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {product.reviewCount > 0
                      ? `${product.rating.toFixed(1)} (${product.reviewCount})`
                      : "No reviews"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm font-semibold text-accent hover:text-accent-strong"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/products"
        page={result.filters.page}
        totalPages={result.totalPages}
        params={{
          q: q || undefined,
          category: category || undefined,
          sort: sort === "newest" ? undefined : sort,
        }}
      />
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
