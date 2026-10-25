import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AssistantChat } from "@/components/assistant-chat";
import { CheckIcon, SparklesIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";

export const metadata: Metadata = {
  title: "Shopping assistant",
  description:
    "Describe what you need and ShopSphere will search the live catalog for matching products, budgets, and alternatives.",
};

const highlights = [
  "Live prices and stock",
  "Budget-aware results",
  "No invented products",
] as const;

type AssistantPageProps = {
  searchParams: Promise<{ productId?: string | string[] }>;
};

function readProductId(value: string | string[] | undefined): string | null {
  const candidate = Array.isArray(value) ? value[0] : value;

  // Only pass a well-formed ObjectId through to the API. The server validates
  // it again; this guard just keeps malformed links from reaching the network.
  return candidate && /^[a-f0-9]{24}$/i.test(candidate) ? candidate : null;
}

export default function AssistantPage({ searchParams }: AssistantPageProps) {
  return (
    <StorefrontShell>
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-accent-soft/80 via-surface to-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong shadow-sm">
              <SparklesIcon className="h-3.5 w-3.5" />
              Smart shopping assistant
            </p>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Tell us what you need. We will search the real shelf.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              Ask in plain language — a product, a budget, a gift idea, or a
              comparison. Results come from the active ShopSphere catalog, so
              every price, rating, and stock count is the same data you see on
              the product page.
            </p>

            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-soft">
              {highlights.map((highlight) => (
                <li key={highlight} className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3.5 w-3.5 text-accent-bright" />
                  {highlight}
                </li>
              ))}
            </ul>

            <p className="mt-4 text-sm text-muted-soft">
              Prefer to browse?{" "}
              <Link
                href="/shop"
                className="font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Open the full catalog
              </Link>
              .
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Suspense fallback={<AssistantSkeleton />}>
          <AssistantContent searchParams={searchParams} />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function AssistantContent({
  searchParams,
}: Pick<AssistantPageProps, "searchParams">) {
  const params = await searchParams;
  const referenceProductId = readProductId(params.productId);

  return <AssistantChat referenceProductId={referenceProductId} />;
}

function AssistantSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"
    >
      <span className="sr-only">Loading the shopping assistant...</span>
      <div aria-hidden="true" className="space-y-4">
        <div className="h-32 animate-pulse rounded-2xl border border-border bg-surface-muted" />
        <div className="h-20 animate-pulse rounded-2xl border border-border bg-surface-muted" />
      </div>
      <div
        aria-hidden="true"
        className="hidden h-64 animate-pulse rounded-2xl border border-border bg-surface-muted lg:block"
      />
    </div>
  );
}
