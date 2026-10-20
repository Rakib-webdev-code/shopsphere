import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryCard } from "@/components/category-card";
import { ArrowRightIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";
import { Alert } from "@/components/ui";
import { listCategories } from "@/lib/services/categories";

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Explore live ShopSphere categories for audio, workspace, home, accessories, outdoor, wellness, and more.",
};

export default function CategoriesPage() {
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
              Categories
            </li>
          </ol>
        </nav>

        <div className="mt-5 max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Collections
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Shop by category
          </h1>
          <p className="mt-3 text-base leading-7 text-muted">
            Each category is managed in MongoDB and only active categories
            appear here. Product counts update as the catalog changes.
          </p>
        </div>

        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoryGrid />
        </Suspense>

        <div className="mt-12 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-8 text-white dark:border-zinc-700 sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">
                Not sure where to start?
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-300">
                Search the full catalog or browse every product with filters and
                sorting.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
            >
              Browse all products
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </div>
    </StorefrontShell>
  );
}

async function CategoryGrid() {
  await connection();
  let categories;

  try {
    categories = await listCategories();
  } catch {
    return (
      <div className="mt-8">
        <Alert tone="error">
          Categories could not be loaded. Please try again.
        </Alert>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          No categories yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          An administrator can add categories from the admin dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

function CategoryGridSkeleton() {
  return (
    <div
      className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-surface p-2"
        >
          <div className="aspect-[5/3] animate-pulse rounded-2xl bg-surface-subtle" />
          <div className="space-y-2 px-3 py-4">
            <div className="h-4 w-28 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
