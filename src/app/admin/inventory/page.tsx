import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { InventoryManager } from "@/components/inventory-manager";
import { Alert, inputClass } from "@/components/ui";
import { listInventory } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Inventory" };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminInventoryPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<InventorySkeleton />}>
      <InventoryContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function InventoryContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const q = firstValue(params.q) ?? "";
  const lowStock = firstValue(params.low) === "1";

  let products;

  try {
    products = await listInventory({ query: q, lowStock });
  } catch {
    return <Alert tone="error">Inventory could not be loaded.</Alert>;
  }

  const lowStockCount = products.filter((product) => product.stock <= 5).length;

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Inventory
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            Update stock directly. Checkout reserves stock with a conditional
            database update, so concurrent orders cannot oversell.
          </p>
        </div>
        <div className="rounded-2xl border border-warning-border bg-warning-soft px-4 py-3 text-sm font-semibold text-warning">
          {lowStockCount} low-stock {lowStockCount === 1 ? "product" : "products"}
        </div>
      </div>

      <form
        action="/admin/inventory"
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="inventory-query" className="text-xs font-semibold text-muted">
            Search by name or SKU
          </label>
          <input
            id="inventory-query"
            name="q"
            defaultValue={q}
            className={inputClass}
            placeholder="e.g. speaker or SS-AUD-01"
          />
        </div>
        <label className="flex items-center gap-2 pb-3 text-sm font-medium text-muted-strong">
          <input
            type="checkbox"
            name="low"
            value="1"
            defaultChecked={lowStock}
            className="h-4 w-4 rounded border-border-strong text-accent-bright focus:ring-accent"
          />
          Low stock only (5 or fewer)
        </label>
        <button
          type="submit"
          className="rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-strong-foreground hover:bg-strong/90"
        >
          Apply
        </button>
        <Link
          href="/admin/inventory"
          className="pb-2.5 text-sm font-semibold text-accent hover:text-accent-strong"
        >
          Reset
        </Link>
      </form>

      <InventoryManager products={products} />
    </div>
  );
}

function InventorySkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
