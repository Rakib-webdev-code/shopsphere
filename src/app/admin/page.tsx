import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  PackageIcon,
  SparklesIcon,
  UserIcon,
} from "@/components/icons";
import {
  LowStockAlerts,
  LowStockAlertsSkeleton,
} from "@/components/low-stock-alerts";
import { OrderStatusBadge } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { getAdminStats } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Dashboard" };

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}

async function DashboardContent() {
  await connection();
  await requireAdminPage();
  const stats = await getAdminStats();

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Store overview
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Live counts from the catalog, orders, and user collections.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Active products" value={String(stats.activeProducts)} detail={`${stats.inactiveProducts} inactive`} />
        <Stat label="Orders" value={String(stats.totalOrders)} detail={`${stats.openOrders} open`} />
        <Stat label="Gross order value" value={formatPrice(stats.grossOrderValueCents)} detail="Excludes cancelled orders" />
        <Stat label="Registered users" value={String(stats.customerCount)} detail={`${stats.activeCategories} active categories`} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Low stock" value={String(stats.lowStockProducts)} detail={`Active products at ${LOW_STOCK_THRESHOLD} or fewer`} href="/admin/inventory?low=1" />
        <Stat label="Open orders" value={String(stats.openOrders)} detail="Pending, confirmed, or processing" href="/admin/orders?status=pending" />
        <Stat label="Cancelled orders" value={String(stats.cancelledOrders)} detail="Inventory released" href="/admin/orders?status=cancelled" />
        <Stat label="Average order" value={stats.totalOrders > 0 ? formatPrice(Math.round(stats.grossOrderValueCents / Math.max(1, stats.totalOrders - stats.cancelledOrders))) : "—"} detail="Across non-cancelled orders" />
      </div>

      <div className="mt-8">
        <Suspense fallback={<LowStockAlertsSkeleton />}>
          <LowStockAlerts />
        </Suspense>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Recent orders
            </h2>
            <Link
              href="/admin/orders"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              All orders
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {stats.recentOrders.length === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-5 py-10 text-center text-sm text-muted">
              No orders have been placed yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-soft">
                    <th className="py-2 pr-4 font-semibold">Order</th>
                    <th className="py-2 pr-4 font-semibold">Customer</th>
                    <th className="py-2 pr-4 font-semibold">Items</th>
                    <th className="py-2 pr-4 font-semibold">Total</th>
                    <th className="py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {stats.recentOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-surface-muted/60">
                      <td className="py-3 pr-4">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="font-semibold text-foreground hover:text-accent"
                        >
                          {order.orderNumber}
                        </Link>
                        <p className="mt-0.5 text-xs text-muted-soft">
                          {new Date(order.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>
                      </td>
                      <td className="py-3 pr-4 text-muted">
                        {order.customerEmail}
                      </td>
                      <td className="py-3 pr-4 text-muted">
                        {order.itemCount}
                      </td>
                      <td className="py-3 pr-4 font-medium text-foreground">
                        {formatPrice(order.totalCents)}
                      </td>
                      <td className="py-3">
                        <OrderStatusBadge status={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <QuickLink
            href="/admin/products/new"
            title="Add a product"
            description="Create a catalog entry with price, stock, and images."
            icon={<PackageIcon className="h-5 w-5" />}
          />
          <QuickLink
            href="/admin/categories"
            title="Manage categories"
            description="Rename, reorder, or deactivate product categories."
            icon={<SparklesIcon className="h-5 w-5" />}
          />
          <QuickLink
            href="/admin/customers"
            title="Review customers"
            description="See registered users, order counts, and total spend."
            icon={<UserIcon className="h-5 w-5" />}
          />
          <QuickLink
            href="/admin/coupons"
            title="Create a coupon"
            description="Percentage and fixed discounts with usage limits."
            icon={<SparklesIcon className="h-5 w-5" />}
          />
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  href?: string;
}) {
  const content = (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-soft">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-soft">{detail}</p>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="rounded-2xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 dark:shadow-black/30"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-5">
      {content}
    </div>
  );
}

function QuickLink({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex gap-3 rounded-2xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 dark:shadow-black/30"
    >
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-soft">
          {description}
        </span>
      </span>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-48 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-surface-subtle" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
