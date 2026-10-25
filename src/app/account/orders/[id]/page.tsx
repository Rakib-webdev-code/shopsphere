import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRightIcon } from "@/components/icons";
import { OrderStatusTimeline } from "@/components/order-status-timeline";
import { MediaThumb } from "@/components/product-media";
import { Alert, OrderStatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { ApiError } from "@/lib/errors";
import { formatPrice } from "@/lib/format";
import { getOrderForUser } from "@/lib/services/orders";
import { getActiveProductLinks } from "@/lib/services/products";

type OrderDetailPageProps = PageProps<"/account/orders/[id]">;

export const metadata: Metadata = {
  title: "Order details",
  robots: { index: false, follow: false },
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

  const productLinks = await getActiveProductLinks(
    order.items.map((item) => item.productId),
  );

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Order tracking
            </h2>
            <p className="mt-1 text-sm text-muted">
              Status changes recorded for this order.
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>
        <OrderStatusTimeline
          history={order.statusHistory}
          createdAt={order.createdAt}
          currentStatus={order.status}
        />
        {order.status === "cancelled" && order.inventoryState === "released" && (
          <p className="mt-4 rounded-2xl bg-surface-subtle px-4 py-3 text-sm text-muted-strong">
            This order was cancelled and its reserved inventory was released.
          </p>
        )}
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">Items</h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((item) => {
              const href = productLinks.get(item.productId);

              return (
                <li
                  key={item.productId}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center"
                >
                  {href ? (
                    <Link href={href} className="w-full shrink-0 sm:w-20">
                      <MediaThumb
                        src={item.image}
                        alt={item.name}
                        variant="thumb"
                        className="aspect-square w-20 rounded-xl"
                      />
                    </Link>
                  ) : (
                    <div className="w-full shrink-0 sm:w-20">
                      <MediaThumb
                        src={item.image}
                        alt={item.name}
                        variant="thumb"
                        className="aspect-square w-20 rounded-xl"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    {href ? (
                      <Link
                        href={href}
                        className="text-sm font-semibold text-foreground hover:text-accent"
                      >
                        {item.name}
                      </Link>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">
                        {item.name}
                      </span>
                    )}
                    <p className="mt-0.5 text-xs text-muted-soft">
                      {formatPrice(item.priceInCents)} × {item.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {formatPrice(item.lineTotalCents)}
                  </p>
                </li>
              );
            })}
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
