import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminCategoryManager } from "@/components/admin-category-manager";
import { Alert } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories";

export const metadata: Metadata = { title: "Categories" };

export default function AdminCategoriesPage() {
  return (
    <Suspense fallback={<CategoriesSkeleton />}>
      <CategoriesContent />
    </Suspense>
  );
}

async function CategoriesContent() {
  await connection();
  await requireAdminPage();
  let categories;

  try {
    categories = await listCategories({ includeInactive: true });
  } catch {
    return <Alert tone="error">Categories could not be loaded.</Alert>;
  }

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Categories
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm text-muted">
          Categories are deactivated rather than deleted so existing product
          references remain valid. Active categories appear in navigation and
          on the homepage.
        </p>
      </div>

      <div className="mt-6">
        <AdminCategoryManager categories={categories} />
      </div>
    </div>
  );
}

function CategoriesSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-12 w-36 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-48 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-48 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
