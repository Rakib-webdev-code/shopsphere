import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminOrderStatusForm } from "@/components/admin-order-status-form";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { MediaThumb } from "@/components/product-media";
import { Alert, OrderStatusBadge } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { ApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { getOrderForAdmin } from "@/lib/services/orders";

export const metadata: Metadata = { title: "Order details" };

type AdminOrderPageProps = PageProps<"/admin/orders/[id]">;

export default function AdminOrderPage(props: AdminOrderPageProps) {
  return (
    <Suspense fallback={<OrderSkeleton />}>
      <AdminOrderContent params={props.params} />
    </Suspense>
  );
}

async function AdminOrderContent({
  params,
}: Pick<AdminOrderPageProps, "params">) {
  await connection();
  await requireAdminPage();
  const { id } = await params;

  let order;

  try {
    order = await getOrderForAdmin(id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      notFound();
    }

    return (
      <Alert tone="error">
        Order details could not be loaded. Please try again in a moment.
      </Alert>
    );
  }

  return (
    <div>
      <Link
        href="/admin/orders"
        className="text-sm font-semibold text-accent hover:text-accent-strong"
      >
        ← Back to orders
      </Link>

      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {order.orderNumber}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {order.customerEmail} · User ID {order.userId}
          </p>
          <p className="mt-1 text-xs text-muted-soft">
            Placed{" "}
            {new Date(order.createdAt).toLocaleString("en-US", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrderStatusBadge status={order.status} />
          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold capitalize text-warning ring-1 ring-warning-border">
            Payment {order.paymentStatus}
          </span>
          <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-semibold text-muted">
            Inventory {order.inventoryState}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">Items</h3>
            <ul className="mt-4 divide-y divide-border">
              {order.items.map((item) => (
                <li
                  key={item.productId}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
                >
                  <MediaThumb
                    src={item.image}
                    alt={item.name}
                    variant="thumb"
                    className="aspect-square w-16 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/shop/${item.slug}`}
                      className="text-sm font-semibold text-foreground hover:text-accent"
                    >
                      {item.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-soft">
                      {formatPrice(item.priceInCents)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPrice(item.lineTotalCents)}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Shipping address
            </h3>
            <address className="mt-3 text-sm not-italic leading-6 text-muted">
              <span className="block font-medium text-foreground">
                {order.shippingAddress.fullName}
              </span>
              {order.shippingAddress.line1}
              {order.shippingAddress.line2
                ? `, ${order.shippingAddress.line2}`
                : ""}
              <br />
              {order.shippingAddress.city}, {order.shippingAddress.state}{" "}
              {order.shippingAddress.postalCode}
              <br />
              {order.shippingAddress.country}
              {order.shippingAddress.phone ? (
                <>
                  <br />
                  {order.shippingAddress.phone}
                </>
              ) : null}
            </address>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Update order
            </h3>
            <div className="mt-4">
              <AdminOrderStatusForm order={order} />
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">
              Status history
            </h3>
            <OrderStatusTimeline
              history={order.statusHistory}
              createdAt={order.createdAt}
              currentStatus={order.status}
            />
          </section>

          <section className="rounded-2xl border border-border bg-surface-muted p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-foreground">Totals</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd className="font-medium text-foreground">
                  {formatPrice(order.subtotalCents)}
                </dd>
              </div>
              {order.discountCents > 0 && (
                <div className="flex justify-between text-accent">
                  <dt>
                    Discount
                    {order.couponCode ? ` (${order.couponCode})` : ""}
                  </dt>
                  <dd>-{formatPrice(order.discountCents)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd className="font-medium text-foreground">
                  {order.shippingCents === 0
                    ? "Free"
                    : formatPrice(order.shippingCents)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
                <dt>Total</dt>
                <dd>{formatPrice(order.totalCents)}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-5 text-muted-soft">
              Payment remains unpaid by design. No card data is collected or
              stored.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-4 h-8 w-64 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-96 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
