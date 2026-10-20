import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutForm } from "@/components/checkout-form";
import { CartIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";
import { Alert } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/services/addresses";
import { getCartForUser } from "@/lib/services/cart";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default function CheckoutPage() {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-soft">
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link
                href="/cart"
                className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Cart
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="font-medium text-foreground">
              Checkout
            </li>
          </ol>
        </nav>

        <div className="mt-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Confirm your shipping details and review the server-calculated total.
            No payment is collected in this project.
          </p>
        </div>

        <Suspense fallback={<CheckoutSkeleton />}>
          <CheckoutContent />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function CheckoutContent() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?next=%2Fcheckout");
  }

  const [cart, addresses] = await Promise.all([
    getCartForUser(user.id),
    listAddresses(user.id),
  ]);

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
          Add at least one product before starting checkout.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-flex rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover"
        >
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      {cart.hasUnavailableItems && (
        <div className="mb-6">
          <Alert tone="error">
            One or more items are unavailable or exceed current stock. Return to
            the{" "}
            <Link href="/cart" className="font-semibold underline">
              cart
            </Link>{" "}
            to fix them before placing an order.
          </Alert>
        </div>
      )}
      <CheckoutForm cart={cart} addresses={addresses} customerName={user.name} />
    </div>
  );
}

function CheckoutSkeleton() {
  return (
    <div
      className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]"
      aria-hidden="true"
    >
      <div className="space-y-6">
        <div className="h-96 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-56 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
      <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
