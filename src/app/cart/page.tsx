import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CartLineControls } from "@/components/cart-line-controls";
import { ArrowRightIcon, CartIcon } from "@/components/icons";
import { MediaThumb } from "@/components/product-media";
import { StorefrontShell } from "@/components/storefront-shell";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_FEE_CENTS,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { getCartForUser } from "@/lib/services/cart";

export const metadata: Metadata = {
  title: "Cart",
  description: "Review your ShopSphere cart and continue to checkout.",
};

export default function CartPage() {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-soft">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href="/"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-foreground">
              Cart
            </li>
          </ol>
        </nav>

        <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Your cart
        </h1>

        <Suspense fallback={<CartSkeleton />}>
          <CartContent />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function CartContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent-border">
          <CartIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-foreground">
          Sign in to see your cart
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Carts are stored with your account so they stay available across
          devices and visits.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            href="/sign-in?next=%2Fcart"
            className="inline-flex rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
          <Link
            href="/shop"
            className="inline-flex rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Continue shopping
          </Link>
        </div>
      </div>
    );
  }

  const cart = await getCartForUser(user.id);

  if (cart.items.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent-border">
          <CartIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-foreground">
          Your cart is empty
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Browse the catalog and add a few considered essentials.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Shop all products
          <ArrowRightIcon />
        </Link>
      </div>
    );
  }

  const shippingCents =
    cart.subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : SHIPPING_FEE_CENTS;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {cart.hasUnavailableItems && (
          <Alert tone="error">
            One or more items are unavailable or exceed current stock. Remove
            or reduce them before checkout.
          </Alert>
        )}

        <ul className="space-y-4">
          {cart.items.map((item) => (
            <li
              key={item.productId}
              className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-3 sm:flex-row sm:items-center sm:p-4"
            >
              <Link
                href={`/shop/${item.slug}`}
                className="w-full shrink-0 sm:w-28"
              >
                <MediaThumb
                  src={item.image}
                  alt={item.name}
                  variant="card"
                  className="aspect-4/3 w-full rounded-xl sm:aspect-square"
                />
              </Link>

              <div className="min-w-0 flex-1">
                <Link
                  href={`/shop/${item.slug}`}
                  className="text-base font-semibold text-foreground hover:text-accent"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-muted-soft">
                  {formatPrice(item.priceInCents)} each
                </p>
                <div className="mt-3">
                  <CartLineControls item={item} />
                </div>
              </div>

              <div className="text-left sm:text-right">
                <p className="text-xs text-muted-soft">Line total</p>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {formatPrice(item.lineTotalCents)}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full text-sm font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Continue shopping
            <ArrowRightIcon />
          </Link>
          <p className="text-sm text-muted">
            {cart.itemCount} {cart.itemCount === 1 ? "item" : "items"}
          </p>
        </div>
      </div>

      <aside className="h-fit rounded-2xl border border-border bg-surface-muted p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold text-foreground">Cart summary</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-medium text-foreground">
              {formatPrice(cart.subtotalCents)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Estimated shipping</dt>
            <dd className="font-medium text-foreground">
              {shippingCents === 0 ? "Free" : formatPrice(shippingCents)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
            <dt>Estimated total</dt>
            <dd>{formatPrice(cart.subtotalCents + shippingCents)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs leading-5 text-muted-soft">
          Coupons are applied on the checkout page. Final totals are calculated
          on the server.
        </p>
        <Link
          href="/checkout"
          aria-disabled={cart.hasUnavailableItems}
          className={`mt-5 w-full rounded-full px-5 py-3 text-center text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
            cart.hasUnavailableItems
              ? "pointer-events-none bg-surface-subtle text-muted-soft"
              : "bg-accent-solid text-white hover:bg-accent-solid-hover"
          }`}
        >
          Proceed to checkout
        </Link>
        <p className="mt-3 text-center text-xs text-muted-soft">
          Free shipping on orders of {formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}{" "}
          or more.
        </p>
      </aside>
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]" aria-hidden="true">
      <div className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-32 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
