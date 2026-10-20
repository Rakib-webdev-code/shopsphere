import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon, SparklesIcon } from "@/components/icons";
import { StorefrontShell } from "@/components/storefront-shell";

export const metadata: Metadata = {
  title: "About",
  description:
    "Learn about ShopSphere, a learning-focused demo storefront for considered everyday essentials.",
};

const principles = [
  {
    title: "A focused catalog",
    description:
      "Fewer, better choices make browsing calmer and decisions easier to understand.",
  },
  {
    title: "Clear product details",
    description:
      "Each product page presents the useful information first: price, description, rating, and highlights.",
  },
  {
    title: "Built to be learned from",
    description:
      "ShopSphere is also a full-stack learning project, so the code favors readable patterns over clever shortcuts.",
  },
] as const;

export default function AboutPage() {
  return (
    <StorefrontShell>
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-accent-soft/80 via-surface to-surface">
        <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <div className="max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong shadow-sm">
              <SparklesIcon className="h-3.5 w-3.5" />
              About ShopSphere
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              A calmer way to shop for everyday things.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted sm:text-lg">
              ShopSphere is a demo storefront built to explore modern full-stack
              commerce with Next.js. The catalog is sample content, but the
              layout, navigation, search, and product pages are designed as a
              real storefront experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Explore the catalog
                <ArrowRightIcon />
              </Link>
              <Link
                href="/categories"
                className="inline-flex items-center rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                View categories
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface py-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              What we value
            </p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Simple ideas, carefully applied.
            </h2>
          </div>

          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {principles.map((principle) => (
              <li
                key={principle.title}
                className="rounded-2xl border border-border bg-surface p-6 transition-colors hover:border-accent-border"
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
                  <CheckIcon className="h-4 w-4" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-foreground">
                  {principle.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {principle.description}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="border-t border-border bg-surface-muted py-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Phase 1
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Catalog first, checkout later.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              This phase focuses on the storefront experience: browsing,
              searching, filtering, and learning about products. Accounts,
              authentication, and the surrounding app are kept intact for the
              next phases.
            </p>
          </div>
          <div className="rounded-2xl border border-accent-border bg-accent-soft p-6 sm:p-8">
            <h3 className="text-lg font-semibold text-accent-strong">
              What is included now
            </h3>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-accent-strong">
              <li className="flex gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent" />
                Responsive homepage, product listing, and product details
              </li>
              <li className="flex gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent" />
                Search and category filtering
              </li>
              <li className="flex gap-3">
                <CheckIcon className="mt-1 h-4 w-4 shrink-0 text-accent" />
                Existing sign-in and sign-up routes preserved
              </li>
            </ul>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}
