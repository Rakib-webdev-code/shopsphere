import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Alert, OrderStatusBadge, Pagination, inputClass } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { ADMIN_ORDERS_PER_PAGE, ORDER_STATUSES } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { listOrdersForAdmin } from "@/lib/services/orders";

export const metadata: Metadata = { title: "Orders" };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminOrdersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OrdersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdminPage();
  const params = await searchParams;
  const status = firstValue(params.status) ?? "";
  const query = firstValue(params.q) ?? "";
  const page = Number(firstValue(params.page) ?? "1");
  const safePage = Number.isSafeInteger(page) && page > 0 ? page : 1;

  let result;

  try {
    result = await listOrdersForAdmin({
      status: status || undefined,
      query: query || undefined,
      page: safePage,
      pageSize: ADMIN_ORDERS_PER_PAGE,
    });
  } catch {
    return <Alert tone="error">Orders could not be loaded.</Alert>;
  }

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">Orders</h2>
        <p className="mt-1.5 text-sm text-muted">
          {result.total} {result.total === 1 ? "order" : "orders"}. Totals were
          calculated server-side at checkout.
        </p>
      </div>

      <form
        action="/admin/orders"
        method="get"
        className="mt-6 grid gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
      >
        <div>
          <label htmlFor="order-query" className="text-xs font-semibold text-muted">
            Search
          </label>
          <input
            id="order-query"
            name="q"
            defaultValue={query}
            placeholder="Order number or customer email"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="order-status-filter" className="text-xs font-semibold text-muted">
            Status
          </label>
          <select
            id="order-status-filter"
            name="status"
            defaultValue={status}
            className={inputClass}
          >
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            className="w-full rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-strong-foreground hover:bg-strong/90 sm:w-auto"
          >
            Filter
          </button>
        </div>
      </form>

      {result.orders.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">No orders found</p>
          <p className="mt-2 text-sm text-muted">
            Clear the filters or wait for a customer to check out.
          </p>
          <Link href="/admin/orders" className="mt-4 inline-flex text-sm font-semibold text-accent underline">
            Clear filters
          </Link>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Order</th>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Items</th>
                <th className="px-4 py-3 font-semibold">Total</th>
                <th className="px-4 py-3 font-semibold">Payment</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {result.orders.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-semibold text-foreground hover:text-accent"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-soft">
                      {new Date(order.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {order.customerEmail}
                  </td>
                  <td className="px-4 py-3 text-muted">{order.itemCount}</td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatPrice(order.totalCents)}
                  </td>
                  <td className="px-4 py-3 capitalize text-muted">
                    {order.paymentStatus}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-sm font-semibold text-accent hover:text-accent-strong"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        basePath="/admin/orders"
        page={result.page}
        totalPages={result.totalPages}
        params={{
          q: query || undefined,
          status: status || undefined,
        }}
      />
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-24 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
