import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { Suspense } from "react";
import { AdminProductForm } from "@/components/admin-product-form";
import { requireAdminPage } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories";

export const metadata: Metadata = { title: "New product" };

export default function NewProductPage() {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <NewProductContent />
    </Suspense>
  );
}

async function NewProductContent() {
  await connection();
  await requireAdminPage();
  const categories = await listCategories({ includeInactive: true });

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-sm font-semibold text-accent hover:text-accent-strong"
      >
        ← Back to products
      </Link>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        Add a product
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Products are immediately visible when active. Stock is reserved during
        checkout and released if an order is cancelled.
      </p>

      <div className="mt-6">
        <AdminProductForm categories={categories} />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-4 h-8 w-48 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-[42rem] animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
