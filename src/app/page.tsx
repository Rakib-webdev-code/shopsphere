import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CategoryCard } from "@/components/category-card";
import {
  ArrowRightIcon,
  CheckIcon,
  SparklesIcon,
  StarIcon,
} from "@/components/icons";
import { ProductList, ProductGridSkeleton } from "@/components/product-list";
import { ProductMedia } from "@/components/product-media";
import { StorefrontSearch } from "@/components/storefront-search";
import { StorefrontShell } from "@/components/storefront-shell";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import { getFeaturedProducts, listProducts } from "@/lib/services/products";
import { listCategories } from "@/lib/services/categories";

const values = [
  {
    title: "Curated, not crowded",
    description: "A focused edit of useful, well-made everyday pieces.",
  },
  {
    title: "Considered details",
    description: "Calm colours, honest materials, and thoughtful finishes.",
  },
  {
    title: "Checked at checkout",
    description:
      "Stock, prices, discounts, and totals are validated again on the server.",
  },
] as const;

export default function Home() {
  return (
    <StorefrontShell>
      <section className="relative overflow-hidden border-b border-border bg-linear-to-b from-accent-soft/80 via-surface to-surface">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-bright/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-accent-bright/5 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto grid w-full max-w-7xl gap-14 px-4 py-14 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:px-8 lg:py-20">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-accent-border bg-surface/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-strong shadow-sm">
              <SparklesIcon className="h-3.5 w-3.5" />
              The new season edit
            </p>

            <h1 className="mt-6 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Everyday essentials,{" "}
              <span className="text-accent">thoughtfully chosen.</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
              Discover clean design, honest materials, and small upgrades for
              your home, workspace, and everywhere in between.
            </p>

            <div className="mt-8 max-w-xl">
              <StorefrontSearch variant="hero" />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Shop all products
                <ArrowRightIcon />
              </Link>
              <Link
                href="/categories"
                className="inline-flex items-center rounded-full border border-border-strong bg-surface px-6 py-3 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                Explore categories
              </Link>
            </div>

            <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted-soft">
              {[
                `Free shipping over ${formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}`,
                "Server-validated checkout",
                "Account-based cart",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-1.5">
                  <CheckIcon className="h-3.5 w-3.5 text-accent-bright" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <Suspense fallback={<SpotlightSkeleton />}>
            <HomeSpotlight />
          </Suspense>
        </div>
      </section>

      <section
        aria-label="ShopSphere values"
        className="border-b border-border bg-surface"
      >
        <ul className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          {values.map((value) => (
            <li key={value.title} className="flex gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
                <CheckIcon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {value.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {value.description}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="categories-heading"
        className="border-b border-border bg-surface-muted/70 py-16"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Browse the edit
              </p>
              <h2
                id="categories-heading"
                className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Shop by category
              </h2>
              <p className="mt-3 text-base leading-7 text-muted">
                Small collections, each built around the way everyday spaces
                and routines actually feel.
              </p>
            </div>
            <Link
              href="/categories"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              View all categories
              <ArrowRightIcon />
            </Link>
          </div>

          <Suspense fallback={<CategoryGridSkeleton />}>
            <HomeCategories />
          </Suspense>
        </div>
      </section>

      <section aria-labelledby="featured-heading" className="bg-surface py-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                The short list
              </p>
              <h2
                id="featured-heading"
                className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Featured this week
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
                A small edit from the live catalog, chosen to show the range of
                the storefront.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 text-sm font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              View all products
              <ArrowRightIcon />
            </Link>
          </div>

          <div className="mt-8">
            <Suspense fallback={<ProductGridSkeleton count={4} />}>
              <HomeFeatured />
            </Suspense>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="assistant-heading"
        className="border-t border-border bg-surface py-16"
      >
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 rounded-2xl border border-accent-border bg-accent-soft p-6 sm:p-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="max-w-2xl">
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <SparklesIcon className="h-4 w-4" />
                Smart shopping assistant
              </p>
              <h2
                id="assistant-heading"
                className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
              >
                Describe the thing. We will find the shelf.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-strong">
                Ask for a gift under a budget, compare two products, or look for
                an alternative to something that is sold out. Every result is
                checked against the live catalog price and stock before it is
                shown.
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs font-medium text-muted">
                {[
                  "No invented products",
                  "Budget-aware suggestions",
                  "Real stock counts",
                ].map((item) => (
                  <li key={item} className="inline-flex items-center gap-1.5">
                    <CheckIcon className="h-3.5 w-3.5 text-accent-bright" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href="/assistant"
              className="inline-flex w-fit items-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Ask the assistant
              <ArrowRightIcon />
            </Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="workspace-heading" className="pb-16">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-12 text-white dark:border-zinc-700 sm:px-10 lg:px-14">
            <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

            <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  The workspace edit
                </p>
                <h2
                  id="workspace-heading"
                  className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
                >
                  Make a little more room for focus.
                </h2>
                <p className="mt-4 text-base leading-7 text-zinc-300">
                  Quietly functional pieces for clearer desks, calmer
                  afternoons, and work that feels a little less hurried.
                </p>
              </div>
              <Link
                href="/shop?category=workspace"
                className="inline-flex w-fit items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900"
              >
                Shop the workspace
                <ArrowRightIcon />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  );
}

async function HomeSpotlight() {
  await connection();
  const featured = await getFeaturedProducts(1);
  const product =
    featured[0] ?? (await listProducts({ pageSize: "1" })).products[0];

  if (!product) {
    return (
      <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center shadow-sm">
        <p className="text-lg font-semibold text-foreground">
          The catalog is being prepared
        </p>
        <p className="mt-2 text-sm leading-6 text-muted">
          Add products through the admin dashboard or run the sample seed
          script to populate the storefront.
        </p>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
      <div className="absolute right-5 top-20 z-10 hidden rounded-2xl border border-accent-border bg-surface px-4 py-3 shadow-lg shadow-black/10 dark:shadow-black/40 sm:block">
        {product.reviewCount > 0 ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-lg font-bold text-foreground">
              <StarIcon className="h-4 w-4 text-accent-bright" />
              {product.rating.toFixed(1)} / 5
            </p>
            <p className="mt-0.5 text-xs text-muted-soft">
              From {product.reviewCount} verified review
              {product.reviewCount === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold text-foreground">New in</p>
            <p className="mt-0.5 text-xs text-muted-soft">Be the first to review</p>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/10 ring-1 ring-border/70 dark:shadow-black/40">
        <div className="relative">
          <ProductMedia
            product={product}
            variant="hero"
            className="aspect-square rounded-2xl"
            priority
          />
          {product.badge && (
            <span className="absolute left-4 top-4 rounded-full bg-strong px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-strong-foreground shadow-sm">
              {product.badge}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 px-3 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
              {product.category?.name ?? "Featured"}
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {product.name}
            </p>
            <p className="mt-0.5 text-sm text-muted">
              {formatPrice(product.priceInCents)}
            </p>
          </div>
          <Link
            href={`/shop/${product.slug}`}
            aria-label={`View ${product.name}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-solid text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <ArrowRightIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-soft">
        Live catalog data stored in MongoDB
      </p>
    </div>
  );
}

async function HomeCategories() {
  await connection();
  const categories = await listCategories();

  if (categories.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-border-strong bg-surface px-6 py-12 text-center text-sm text-muted">
        Categories will appear here once they are added in the admin dashboard.
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  );
}

async function HomeFeatured() {
  await connection();
  const featured = await getFeaturedProducts(4);
  const products =
    featured.length > 0
      ? featured
      : (await listProducts({ pageSize: "4", sort: "newest" })).products;

  return <ProductList products={products} columns={4} />;
}

function SpotlightSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="rounded-2xl border border-border bg-surface p-3 shadow-2xl shadow-black/10 ring-1 ring-border/70 dark:shadow-black/40">
        <div className="aspect-square animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="space-y-2 px-3 py-4">
          <div className="h-3 w-24 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-4 w-48 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-4 w-20 animate-pulse rounded-full bg-surface-subtle" />
        </div>
      </div>
    </div>
  );
}

function CategoryGridSkeleton() {
  return (
    <div
      className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      aria-hidden="true"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="rounded-2xl border border-border bg-surface p-2"
        >
          <div className="aspect-[5/3] animate-pulse rounded-xl bg-surface-subtle" />
          <div className="space-y-2 px-3 py-4">
            <div className="h-4 w-28 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-surface-subtle" />
          </div>
        </div>
      ))}
    </div>
  );
}
