import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminProductForm } from "@/components/admin-product-form";
import { requireAdminPage } from "@/lib/auth/session";
import { listCategories } from "@/lib/services/categories";
import { getProductById } from "@/lib/services/products";

export const metadata: Metadata = { title: "Edit product" };

type EditProductPageProps = PageProps<"/admin/products/[id]">;

export default function EditProductPage(props: EditProductPageProps) {
  return (
    <Suspense fallback={<FormSkeleton />}>
      <EditProductContent params={props.params} />
    </Suspense>
  );
}

async function EditProductContent({
  params,
}: Pick<EditProductPageProps, "params">) {
  await connection();
  await requireAdminPage();
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getProductById(id, { includeInactive: true }),
    listCategories({ includeInactive: true }),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/admin/products"
        className="text-sm font-semibold text-accent hover:text-accent-strong"
      >
        ← Back to products
      </Link>
      <h2 className="mt-3 text-2xl font-bold tracking-tight text-foreground">
        Edit {product.name}
      </h2>
      <p className="mt-1.5 text-sm text-muted">
        Changes apply after you save. Deactivating hides the product without
        deleting its order history.
      </p>

      <div className="mt-6">
        <AdminProductForm categories={categories} product={product} />
      </div>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-[42rem] animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
