import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { MediaThumb } from "@/components/product-media";
import { Alert, OrderStatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { getOrderForUser } from "@/lib/services/orders";
import type { OrderStatus } from "@/lib/types";

type OrderDetailPageProps = PageProps<"/account/orders/[id]">;

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
};

const timeline: OrderStatus[] = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
];

const timelineLabels: Record<OrderStatus, string> = {
  pending: "Order placed",
  confirmed: "Confirmed",
  processing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrderDetailPage(props: OrderDetailPageProps) {
  return (
    <Suspense fallback={<OrderDetailSkeleton />}>
      <OrderDetail params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function OrderDetail({
  params,
  searchParams,
}: Pick<OrderDetailPageProps, "params" | "searchParams">) {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const { id } = await params;
  const search = await searchParams;
  const created = (Array.isArray(search.created) ? search.created[0] : search.created) === "1";

  let order;

  try {
    order = await getOrderForUser(user.id, id);
  } catch {
    notFound();
  }

  const currentIndex = timeline.indexOf(order.status);
  const isCancelled = order.status === "cancelled";

  return (
    <div>
      {created && (
        <div className="mb-6">
          <Alert tone="success">
            Order placed. Your inventory is reserved, and no payment has been
            collected. Keep this page for your order number.
          </Alert>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Order {order.orderNumber}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Order details
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
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
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Progress</h2>
        {isCancelled ? (
          <div className="mt-4 rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-muted-strong">
            This order was cancelled. Reserved inventory has been released.
          </div>
        ) : (
          <ol className="mt-5 grid gap-3 sm:grid-cols-5">
            {timeline.map((step, index) => {
              const complete = index <= currentIndex;
              return (
                <li key={step} className="flex items-center gap-2 sm:block">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      complete
                        ? "bg-accent-solid text-white"
                        : "bg-surface-subtle text-faint"
                    }`}
                  >
                    {complete ? <CheckIcon className="h-4 w-4" /> : index + 1}
                  </span>
                  <p
                    className={`mt-2 text-xs font-semibold ${
                      complete ? "text-foreground" : "text-faint"
                    }`}
                  >
                    {timelineLabels[step]}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Items</h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((item) => (
              <li
                key={item.productId}
                className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
              >
                <Link href={`/shop/${item.slug}`} className="w-full shrink-0 sm:w-20">
                  <MediaThumb
                    src={item.image}
                    alt={item.name}
                    variant="thumb"
                    className="aspect-square w-20 rounded-xl"
                  />
                </Link>
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

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface-muted p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Order summary
            </h2>
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
          </section>

          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Shipping address
            </h2>
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
        </aside>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong hover:bg-surface-muted"
        >
          Back to orders
        </Link>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover"
        >
          Continue shopping
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}

function OrderDetailSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-9 w-64 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 h-32 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
