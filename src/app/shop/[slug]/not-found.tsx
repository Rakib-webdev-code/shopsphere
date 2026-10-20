import Link from "next/link";
import { ArrowRightIcon, PackageIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";

export default function ProductNotFound() {
  return (
    <StorefrontShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
          <PackageIcon className="h-7 w-7" />
        </span>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          404 · Product not found
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          We could not find that product
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          The product may have moved, or the link may be out of date. Browse the
          demo catalog to find something else.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Browse all products
            <ArrowRightIcon />
          </Link>
          <Link
            href="/categories"
            className="inline-flex items-center rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Explore categories
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
