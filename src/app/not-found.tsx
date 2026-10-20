import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";

export default function NotFound() {
  return (
    <StorefrontShell>
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8 lg:py-28">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          404 · Page not found
        </p>
        <p
          aria-hidden="true"
          className="mt-4 text-7xl font-bold tracking-tighter text-zinc-200 dark:text-zinc-800 sm:text-8xl"
        >
          404
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          This page is out of stock
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          The page you are looking for does not exist or may have moved. The
          catalog is still open, so there is plenty more to browse.
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
            href="/"
            className="inline-flex items-center rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Return home
          </Link>
        </div>
      </div>
    </StorefrontShell>
  );
}
