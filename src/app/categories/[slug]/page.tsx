import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  ProductGridSkeleton,
  ProductList,
} from "@/components/product-list";
import { StorefrontShell } from "@/components/storefront-shell";
import { Alert, Pagination } from "@/components/ui";
import { listProducts } from "@/lib/services/products";
import { getCategoryBySlug } from "@/lib/services/categories";
import { parsePage } from "@/lib/validation";

type CategoryPageProps = PageProps<"/categories/[slug]">;

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    return { title: "Category not found" };
  }

  return {
    title: category.name,
    description: category.description,
  };
}

export default function CategoryPage({ params, searchParams }: CategoryPageProps) {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Suspense fallback={<CategoryDetailSkeleton />}>
          <CategoryDetail params={params} searchParams={searchParams} />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function CategoryDetail({
  params,
  searchParams,
}: Pick<CategoryPageProps, "params" | "searchParams">) {
  await connection();
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const search = await searchParams;
  const rawPage = Array.isArray(search.page) ? search.page[0] : search.page;
  let results;

  try {
    const page = parsePage(rawPage ?? null);
    results = await listProducts({
      category: category.slug,
      page: String(page),
      pageSize: "12",
    });
  } catch {
    return <Alert tone="error">This category could not be loaded.</Alert>;
  }

  return (
    <>
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
          <li>
            <Link
              href="/categories"
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Categories
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {category.name}
          </li>
        </ol>
      </nav>

      <div className="mt-5 flex flex-col gap-5 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Category
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {category.name}
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            {category.description}
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          <span className="font-semibold text-foreground">{results.total}</span>{" "}
          active {results.total === 1 ? "product" : "products"}
        </div>
      </div>

      <div className="mt-8">
        <ProductList
          products={results.products}
          emptyTitle={`No products in ${category.name} yet`}
          emptyDescription="Browse the full catalog or check back after the next catalog update."
        />
        <Pagination
          basePath={`/categories/${category.slug}`}
          page={results.filters.page}
          totalPages={results.totalPages}
        />
      </div>
    </>
  );
}

function CategoryDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-64 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-5 space-y-3 border-b border-border pb-8">
        <div className="h-3 w-24 animate-pulse rounded-full bg-surface-subtle" />
        <div className="h-9 w-64 animate-pulse rounded-full bg-surface-subtle" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded-full bg-surface-subtle" />
      </div>
      <div className="mt-8">
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
