import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AddToCartForm } from "@/components/add-to-cart-form";
import {
  ArrowRightIcon,
  CheckIcon,
  StarIcon,
} from "@/components/icons";
import { ProductGallery } from "@/components/product-gallery";
import { ProductList } from "@/components/product-list";
import { Rating } from "@/components/rating";
import {
  DeleteReviewButton,
  ReviewForm,
} from "@/components/review-form";
import { StorefrontShell } from "@/components/storefront-shell";
import { WishlistButton } from "@/components/wishlist-button";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/services/products";
import { listProductReviews } from "@/lib/services/reviews";
import { parseObjectId } from "@/lib/validation";
import type { Product, ProductBadge } from "@/lib/types";

type ProductPageProps = PageProps<"/shop/[slug]">;

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return {
      title: "Product not found",
      description: "The requested ShopSphere product could not be found.",
    };
  }

  return {
    title: product.name,
    description: product.summary,
    openGraph: {
      title: product.name,
      description: product.summary,
      type: "website",
    },
  };
}

const badgeLabels: Record<ProductBadge, string> = {
  bestseller: "Bestseller",
  new: "New arrival",
  limited: "Limited edition",
};

export default function ProductPage({ params }: ProductPageProps) {
  return (
    <StorefrontShell>
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <Suspense fallback={<ProductDetailSkeleton />}>
          <ProductDetail params={params} />
        </Suspense>
      </div>
    </StorefrontShell>
  );
}

async function ProductDetail({ params }: Pick<ProductPageProps, "params">) {
  await connection();
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product, 3);
  const isOnSale = product.compareAtPriceInCents !== null;

  return (
    <>
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
          <li>
            <Link
              href="/shop"
              className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Shop
            </Link>
          </li>
          {product.category && (
            <>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/categories/${product.category.slug}`}
                  className="transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {product.category.name}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {product.name}
          </li>
        </ol>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="self-start lg:sticky lg:top-28">
          <div className="relative">
            <ProductGallery product={product} />
            {product.badge && (
              <span className="absolute left-5 top-5 rounded-full bg-strong px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-strong-foreground shadow-sm">
                {badgeLabels[product.badge]}
              </span>
            )}
            {isOnSale && (
              <span className="absolute right-5 top-5 rounded-full bg-surface/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-foreground shadow-sm ring-1 ring-border backdrop-blur">
                Sale
              </span>
            )}
          </div>
          <p className="mt-3 text-center text-xs text-muted-soft">
            SKU {product.sku}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {product.category ? (
              <Link
                href={`/categories/${product.category.slug}`}
                className="hover:text-accent-strong"
              >
                {product.category.name}
              </Link>
            ) : (
              "ShopSphere"
            )}
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {product.name}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <Rating rating={product.rating} reviewCount={product.reviewCount} />
            <span
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                product.inStock
                  ? "bg-accent-soft text-accent-strong ring-accent-border"
                  : "bg-surface-subtle text-muted ring-border"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  product.inStock ? "bg-accent-solid" : "bg-faint"
                }`}
              />
              {product.inStock
                ? product.stock <= 5
                  ? `Only ${product.stock} left`
                  : "In stock"
                : "Out of stock"}
            </span>
          </div>

          <div className="mt-5 flex flex-wrap items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">
              {formatPrice(product.priceInCents)}
            </span>
            {product.compareAtPriceInCents !== null && (
              <span className="text-lg text-faint">
                <span className="sr-only">Original price </span>
                <span className="line-through">
                  {formatPrice(product.compareAtPriceInCents)}
                </span>
              </span>
            )}
          </div>

          <p className="mt-2 text-sm font-medium text-muted-soft">
            {product.summary}
          </p>

          <p className="mt-6 whitespace-pre-line text-base leading-7 text-muted">
            {product.description}
          </p>

          {product.highlights.length > 0 && (
            <div className="mt-8 border-t border-border pt-7">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-foreground">
                What makes it different
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {product.highlights.map((highlight) => (
                  <li
                    key={highlight}
                    className="flex gap-3 text-sm leading-6 text-muted-strong"
                  >
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
                      <CheckIcon className="h-3 w-3" />
                    </span>
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-8 space-y-4 border-t border-border pt-7">
            <AddToCartForm productId={product.id} stock={product.stock} />
            <WishlistButton productId={product.id} />
          </div>

          <div className="mt-6 rounded-2xl border border-accent-border bg-accent-soft p-5">
            <p className="text-sm font-semibold text-accent-strong">
              Server-checked checkout
            </p>
            <p className="mt-1.5 text-sm leading-6 text-accent-strong">
              Prices, stock, coupons, and totals are recalculated on the server
              when you place an order. No payment is collected in this demo;
              orders are recorded as unpaid.
            </p>
          </div>
        </div>
      </div>

      <Suspense fallback={<ReviewsSkeleton />}>
        <ProductReviews product={product} />
      </Suspense>

      {relatedProducts.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="mt-16 border-t border-border pt-12"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                Keep exploring
              </p>
              <h2
                id="related-heading"
                className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
              >
                You may also like
              </h2>
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
            <ProductList products={relatedProducts} columns={3} />
          </div>
        </section>
      )}
    </>
  );
}

async function ProductReviews({ product }: { product: Product }) {
  const currentUser = await getCurrentUser();
  const reviews = await listProductReviews(
    parseObjectId(product.id, "Product ID"),
    currentUser?.id,
    30,
  );
  const ownReview = reviews.find((review) => review.isOwn);

  return (
    <section
      id="reviews"
      aria-labelledby="reviews-heading"
      className="mt-16 border-t border-border pt-12"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Customer reviews
          </p>
          <h2
            id="reviews-heading"
            className="mt-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
          >
            What people are saying
          </h2>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted px-4 py-3">
          <StarIcon className="h-6 w-6 text-accent-bright" />
          <div>
            <p className="text-lg font-bold text-foreground">
              {product.reviewCount > 0 ? product.rating.toFixed(1) : "—"}
            </p>
            <p className="text-xs text-muted-soft">
              {product.reviewCount} review
              {product.reviewCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          {reviews.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-12 text-center">
              <h3 className="text-lg font-semibold text-foreground">
                No reviews yet
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
                Be the first to share an honest review. Only signed-in customers
                can publish reviews.
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {reviews.map((review) => (
                <li
                  key={review.id}
                  className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
                          <StarIcon className="h-4 w-4 text-accent-bright" />
                          {review.rating}.0
                        </span>
                        {review.verifiedPurchase && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong ring-1 ring-accent-border">
                            <CheckIcon className="h-3 w-3" />
                            Verified purchase
                          </span>
                        )}
                        {review.isOwn && (
                          <span className="rounded-full bg-strong px-2 py-0.5 text-[11px] font-semibold text-strong-foreground">
                            Your review
                          </span>
                        )}
                      </div>
                      {review.title && (
                        <h3 className="mt-2 text-base font-semibold text-foreground">
                          {review.title}
                        </h3>
                      )}
                    </div>
                    <time
                      dateTime={review.createdAt}
                      className="text-xs text-muted-soft"
                    >
                      {new Date(review.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted">
                    {review.body}
                  </p>
                  <p className="mt-3 text-xs font-medium text-muted-soft">
                    {review.authorName}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <aside className="h-fit rounded-2xl border border-border bg-surface-muted p-5 sm:p-6">
          {!currentUser ? (
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Have this product?
              </h3>
              <p className="mt-2 text-sm leading-6 text-muted">
                Sign in to leave a review. Your review is tied to your account
                and only you can edit or delete it.
              </p>
              <Link
                href={`/sign-in?next=${encodeURIComponent(`/shop/${product.slug}`)}`}
                className="mt-4 inline-flex rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover"
              >
                Sign in to review
              </Link>
            </div>
          ) : ownReview ? (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold text-foreground">
                  Your review
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted">
                  Update your rating or wording, or remove the review.
                </p>
              </div>
              <ReviewForm productSlug={product.slug} existingReview={ownReview} />
              <DeleteReviewButton reviewId={ownReview.id} />
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                Write a review
              </h3>
              <p className="mt-1 mb-4 text-sm leading-6 text-muted">
                Reviews are public. Purchases are checked against your delivered
                orders automatically.
              </p>
              <ReviewForm productSlug={product.slug} />
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function ProductDetailSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading product details...</span>
      <div aria-hidden="true">
        <div className="h-4 w-64 animate-pulse rounded-full bg-surface-subtle" />
        <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="aspect-square animate-pulse rounded-2xl bg-surface-subtle" />
          <div className="space-y-4 pt-2">
            <div className="h-3 w-24 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-9 w-4/5 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-4 w-40 animate-pulse rounded-full bg-surface-subtle" />
            <div className="h-8 w-28 animate-pulse rounded-full bg-surface-subtle" />
            <div className="space-y-2 pt-4">
              <div className="h-4 w-full animate-pulse rounded-full bg-surface-subtle" />
              <div className="h-4 w-full animate-pulse rounded-full bg-surface-subtle" />
              <div className="h-4 w-2/3 animate-pulse rounded-full bg-surface-subtle" />
            </div>
            <div className="h-40 animate-pulse rounded-2xl bg-surface-subtle" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewsSkeleton() {
  return (
    <div className="mt-16 border-t border-border pt-12" aria-hidden="true">
      <div className="h-3 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-8 w-64 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-2xl bg-surface-subtle" />
          <div className="h-40 animate-pulse rounded-2xl bg-surface-subtle" />
        </div>
        <div className="h-64 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
