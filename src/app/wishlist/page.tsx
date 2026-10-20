import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { HeartIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { ProductGridSkeleton } from "@/components/product-list";
import { StorefrontShell } from "@/components/storefront-shell";
import { WishlistRemoveButton } from "@/components/wishlist-remove-button";
import { getCurrentUser } from "@/lib/auth/session";
import { getWishlistForUser } from "@/lib/services/wishlist";

export const metadata: Metadata = {
  title: "Wishlist",
  robots: { index: false, follow: false },
};

export default function WishlistPage() {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
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
              Wishlist
            </li>
          </ol>
        </nav>

        <div className="mt-5">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Wishlist
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Saved products stay with your account. Inactive or removed products no
            longer appear.
          </p>
        </div>

        <Suspense fallback={<WishlistSkeleton />}>
          <WishlistContent />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function WishlistContent() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent-border">
          <HeartIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-foreground">
          Sign in to see your wishlist
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          A wishlist is stored with your account so you can save products for
          later.
        </p>
        <Link
          href="/sign-in?next=%2Fwishlist"
          className="mt-6 inline-flex rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const wishlist = await getWishlistForUser(user.id);

  if (wishlist.products.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-16 text-center">
        <span className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-surface text-accent shadow-sm ring-1 ring-accent-border">
          <HeartIcon className="h-7 w-7" />
        </span>
        <h2 className="mt-5 text-2xl font-bold text-foreground">
          Your wishlist is empty
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          Open a product and choose “Save to wishlist” to keep it here.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-flex rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover"
        >
          Browse the catalog
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-muted">
        {wishlist.products.length}{" "}
        {wishlist.products.length === 1 ? "saved product" : "saved products"}
      </p>
      <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {wishlist.products.map((product) => (
          <div key={product.id} className="flex flex-col">
            <ProductCard product={product} />
            <div className="px-3 pt-2 text-right">
              <WishlistRemoveButton productId={product.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div className="mt-8" aria-hidden="true">
      <div className="h-4 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-5">
        <ProductGridSkeleton count={4} />
      </div>
    </div>
  );
}
