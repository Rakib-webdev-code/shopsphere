"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ProductMedia } from "@/components/product-media";
import { StockStatusBadge } from "@/components/ui";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
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
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
          <tr>
            <th className="px-4 py-3 font-semibold">Product</th>
            <th className="px-4 py-3 font-semibold">SKU</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Current stock</th>
            <th className="px-4 py-3 font-semibold">Adjustment</th>
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
  const [savedStock, setSavedStock] = useState<{
    propStock: number;
    stock: number;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConflict, setIsConflict] = useState(false);
  // The server prop is always authoritative. The local override only bridges
  // the gap between a successful save and the refreshed server payload.
  const baseStock =
    savedStock?.propStock === product.stock
      ? savedStock.stock
      : product.stock;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsConflict(false);
    setIsSaving(true);

    try {
      const data = new FormData(event.currentTarget);
      const reasonText = String(data.get("reason") ?? "").trim();
      const stockText = String(data.get("stock") ?? "").trim();
      const nextStock = Number(stockText);

      if (!stockText || !Number.isSafeInteger(nextStock) || nextStock < 0) {
        throw new Error("Stock must be a whole number of zero or more.");
      }

      if (nextStock === baseStock) {
        throw new Error("Enter a stock level different from the current value.");
      }

      if (reasonText.length < 3) {
        throw new Error("Enter a reason of at least 3 characters.");
      }

      const result = await apiRequest<{ product: Product }>(
        `/api/admin/products/${product.id}/stock`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedStock: baseStock,
            delta: nextStock - baseStock,
            reason: reasonText,
          }),
        },
      );

      setSavedStock({ propStock: product.stock, stock: result.product.stock });
      setReason("");
      setMessage(`Saved. Stock is now ${result.product.stock}.`);
      router.refresh();
    } catch (requestError) {
      if (
        requestError instanceof ApiClientError &&
        requestError.code === "STOCK_CONFLICT"
      ) {
        setIsConflict(true);
        setError(
          "This product's stock changed while the page was open. Refresh to load the latest value, then try again.",
        );
      } else {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to update stock.",
        );
      }
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
            baseStock <= LOW_STOCK_THRESHOLD
              ? "font-semibold text-warning"
              : "font-medium text-foreground"
          }
        >
          {baseStock}
        </span>
        <div className="mt-1">
          <StockStatusBadge
            stock={baseStock}
            threshold={LOW_STOCK_THRESHOLD}
          />
        </div>
      </td>
      <td className="px-4 py-3">
        <form onSubmit={handleSubmit} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              key={baseStock}
              type="number"
              name="stock"
              min="0"
              step="1"
              defaultValue={baseStock}
              aria-label={`New stock for ${product.name}`}
              className="w-24 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
            />
            <input
              type="text"
              name="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={200}
              required
              placeholder="Reason (required)"
              aria-label={`Reason for adjusting ${product.name}`}
              className="w-44 rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-strong px-3 py-2 text-xs font-semibold text-strong-foreground hover:bg-strong/90 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
          {(message || error) && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {message && (
                <span role="status" className="text-accent">
                  {message}
                </span>
              )}
              {error && (
                <span role="alert" className="text-danger">
                  {error}
                </span>
              )}
              {isConflict && (
                <button
                  type="button"
                  onClick={() => {
                    setIsConflict(false);
                    setError(null);
                    router.refresh();
                  }}
                  className="rounded-full border border-border-strong px-2.5 py-1 font-semibold text-accent hover:bg-accent-soft"
                >
                  Refresh stock
                </button>
              )}
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}
