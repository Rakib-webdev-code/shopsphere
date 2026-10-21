import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { Alert, StockStatusBadge } from "@/components/ui";
import { listLowStockAlerts } from "@/lib/services/admin";
import type { LowStockOverview } from "@/lib/types";

/**
 * Server-rendered inventory alert panel for the protected admin dashboard.
 * Admin authorization is enforced by the admin layout before this renders.
 */
export async function LowStockAlerts() {
  let overview: LowStockOverview;

  try {
    overview = await listLowStockAlerts(8);
  } catch {
    return (
      <Alert tone="error">
        Low-stock alerts could not be loaded. You can still manage stock from
        the Inventory page.
      </Alert>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Inventory alerts
          </h2>
          <p className="mt-1 text-sm text-muted">
            {overview.total} active low-stock{" "}
            {overview.total === 1 ? "product" : "products"} ·{" "}
            {overview.outOfStock} out of stock · alert threshold:{" "}
            {overview.threshold}
          </p>
        </div>
        <Link
          href="/admin/inventory?low=1"
          className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Manage inventory
          <ArrowRightIcon />
        </Link>
      </div>

      {overview.items.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-5 py-10 text-center">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
            <CheckIcon />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">
            No low-stock products
          </p>
          <p className="mt-1 text-sm text-muted">
            Every active product is above the threshold of {overview.threshold}.
          </p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[700px] text-left text-sm">
            <caption className="sr-only">
              Active products at or below the low-stock threshold
            </caption>
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-soft">
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Product
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  SKU
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Current stock
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Threshold
                </th>
                <th scope="col" className="py-2 pr-4 font-semibold">
                  Status
                </th>
                <th scope="col" className="py-2 font-semibold">
                  <span className="sr-only">Manage</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {overview.items.map((product) => (
                <tr
                  key={product.id}
                  className="transition-colors hover:bg-surface-muted/60"
                >
                  <td className="py-3 pr-4">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-semibold text-foreground hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-muted">{product.sku || "—"}</td>
                  <td className="py-3 pr-4 font-semibold text-foreground">
                    {product.stock}
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {overview.threshold}
                  </td>
                  <td className="py-3 pr-4">
                    <StockStatusBadge
                      stock={product.stock}
                      threshold={overview.threshold}
                    />
                  </td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="text-sm font-semibold text-accent hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                    >
                      Manage
                      <span className="sr-only"> {product.name}</span>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {overview.total > overview.items.length && (
        <div className="mt-4 border-t border-border pt-4">
          <Link
            href="/admin/inventory?low=1"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            View all {overview.total} low-stock products
            <ArrowRightIcon />
          </Link>
        </div>
      )}
    </section>
  );
}

export function LowStockAlertsSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
    >
      <div className="h-6 w-44 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
