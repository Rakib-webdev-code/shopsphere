"use client";

import Link from "next/link";
import { useEffect } from "react";
import { ArrowRightIcon } from "@/components/icons";

/**
 * Route-level error boundary.
 *
 * Server components can fail when MongoDB or a dependency is unavailable. This
 * keeps the rest of the shell intact and gives the shopper a safe way forward
 * without exposing stack traces, database details, or environment values.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The digest is the only safe correlation value to log in the browser.
    console.error(
      "[shopsphere] Route error",
      error.digest ? `digest=${error.digest}` : "",
    );
  }, [error]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
        Something went wrong
      </p>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        This page could not be loaded.
      </h1>
      <p className="mt-4 max-w-xl text-base leading-7 text-muted">
        The storefront hit an unexpected problem while loading data. Your cart
        and account are stored on the server, so nothing has been lost. Try the
        page again, or continue browsing the catalog.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Try again
        </button>
        <Link
          href="/shop"
          className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Browse the catalog
          <ArrowRightIcon />
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 text-xs text-muted-soft">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
