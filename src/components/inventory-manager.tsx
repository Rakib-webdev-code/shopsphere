"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ProductMedia } from "@/components/product-media";
import { apiRequest } from "@/lib/api-client";
import type { Product } from "@/lib/types";

export function InventoryManager({ products }: { products: Product[] }) {
  if (products.length === 0) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
        <p className="text-lg font-semibold text-foreground">
          No products match this inventory view
        </p>
        <p className="mt-2 text-sm text-muted">
          Clear the search or switch off the low-stock filter.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
          <tr>
            <th className="px-4 py-3 font-semibold">Product</th>
            <th className="px-4 py-3 font-semibold">SKU</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Current stock</th>
            <th className="px-4 py-3 font-semibold">Update</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {products.map((product) => (
            <InventoryRow key={product.id} product={product} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InventoryRow({ product }: { product: Product }) {
  const router = useRouter();
  const [stock, setStock] = useState(String(product.stock));
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const quantity = Number(stock);

      if (!Number.isSafeInteger(quantity) || quantity < 0) {
        throw new Error("Stock must be a whole number of zero or more.");
      }

      await apiRequest<{ product: Product }>(
        `/api/admin/products/${product.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ stock: quantity }),
        },
      );
      setMessage("Saved");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update stock.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <tr className="transition-colors hover:bg-surface-muted/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <ProductMedia
            product={product}
            variant="thumb"
            className="h-10 w-10 shrink-0 rounded-xl"
          />
          <div className="min-w-0">
            <Link
              href={`/admin/products/${product.id}`}
              className="truncate font-semibold text-foreground hover:text-accent"
            >
              {product.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-soft">
              {product.category?.name ?? "Uncategorised"}
            </p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted">{product.sku}</td>
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
      <td className="px-4 py-3">
        <span
          className={
            product.stock <= 5
              ? "font-semibold text-warning"
              : "font-medium text-foreground"
          }
        >
          {product.stock}
        </span>
      </td>
      <td className="px-4 py-3">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(event) => setStock(event.target.value)}
            aria-label={`Stock for ${product.name}`}
            className="w-24 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
          />
          <button
            type="submit"
            disabled={isSaving}
            className="rounded-full bg-strong px-3 py-2 text-xs font-semibold text-strong-foreground hover:bg-strong/90 disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>
          {message && (
            <span role="status" className="text-xs text-accent">
              {message}
            </span>
          )}
          {error && (
            <span role="alert" className="text-xs text-danger">
              {error}
            </span>
          )}
        </form>
      </td>
    </tr>
  );
}
