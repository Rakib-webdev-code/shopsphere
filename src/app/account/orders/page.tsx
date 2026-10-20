import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, PackageIcon } from "@/components/icons";
import { OrderStatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { listOrdersForUser } from "@/lib/services/orders";

export const metadata: Metadata = {
  title: "Order history",
  robots: { index: false, follow: false },
};

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersSkeleton />}>
      <OrdersContent />
    </Suspense>
  );
}

async function OrdersContent() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const orders = await listOrdersForUser(user.id);

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Purchase history
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Your orders
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Every order below belongs to your account. Totals include the
          server-calculated discount and shipping amount.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
          <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent-border">
            <PackageIcon className="h-7 w-7" />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-foreground">
            No orders yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            When you check out, your order history and status updates will appear
            here.
          </p>
          <Link
            href="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover"
          >
            Browse the catalog
            <ArrowRightIcon />
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/account/orders/${order.id}`}
                className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 dark:shadow-black/30 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-base font-semibold text-foreground">
                      {order.orderNumber}
                    </h2>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <p className="mt-1.5 text-sm text-muted-soft">
                    Placed{" "}
                    {new Date(order.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}{" "}
                    · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                  </p>
                  <p className="mt-1 text-xs text-faint">
                    Payment status: {order.paymentStatus}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <p className="text-lg font-bold text-foreground">
                    {formatPrice(order.totalCents)}
                  </p>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-subtle text-muted-strong">
                    <ArrowRightIcon className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-9 w-52 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 space-y-4">
        <div className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
