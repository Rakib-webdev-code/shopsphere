"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import { PRODUCT_BADGES } from "@/lib/constants";
import type { Category, Product } from "@/lib/types";

function dollars(cents: number | null | undefined) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

function toCents(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();

  if (!text) {
    return null;
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Prices must be valid positive numbers.");
  }

  return Math.round(parsed * 100);
}

function lines(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function slugifyClient(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function AdminProductForm({
  categories,
  product,
}: {
  categories: Category[];
  product?: Product;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setError(null);
    setIsSubmitting(true);

    try {
      const name = String(data.get("name") ?? "").trim();
      const slugInput = String(data.get("slug") ?? "").trim();
      const slug = slugInput || slugifyClient(name);
      const priceInCents = toCents(data.get("price"));
      const compareAtPriceInCents = toCents(data.get("compareAtPrice"));

      if (priceInCents === null) {
        throw new Error("Price is required.");
      }

      const payload = {
        name,
        slug,
        sku: String(data.get("sku") ?? "").trim(),
        summary: String(data.get("summary") ?? "").trim(),
        description: String(data.get("description") ?? "").trim(),
        highlights: lines(data.get("highlights")),
        tags: String(data.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean),
        priceInCents,
        compareAtPriceInCents,
        categoryId: String(data.get("categoryId") ?? ""),
        images: lines(data.get("images")),
        // Existing products manage stock through the guarded inventory
        // endpoint. Only creation may send an initial stock value.
        ...(product ? {} : { stock: Number(data.get("stock") ?? 0) }),
        badge: String(data.get("badge") ?? "") || null,
        featured: data.get("featured") === "on",
        active: data.get("active") === "on",
      };

      await apiRequest<{ product: Product }>(
        product ? `/api/admin/products/${product.id}` : "/api/admin/products",
        {
          method: product ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );

      router.push("/admin/products");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the product.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivate() {
    if (!product) {
      return;
    }

    if (!window.confirm("Deactivate this product? It will disappear from the storefront.")) {
      return;
    }

    setError(null);
    setIsDeactivating(true);

    try {
      await apiRequest(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });
      router.push("/admin/products");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to deactivate the product.",
      );
    } finally {
      setIsDeactivating(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">Basics</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="name" className={labelClass}>
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={product?.name ?? ""}
              required
              maxLength={120}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="slug" className={labelClass}>
              Slug
            </label>
            <input
              id="slug"
              name="slug"
              defaultValue={product?.slug ?? ""}
              maxLength={80}
              placeholder="Generated from name if blank"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="sku" className={labelClass}>
              SKU
            </label>
            <input
              id="sku"
              name="sku"
              defaultValue={product?.sku ?? ""}
              required
              maxLength={40}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="summary" className={labelClass}>
              Summary
            </label>
            <textarea
              id="summary"
              name="summary"
              defaultValue={product?.summary ?? ""}
              required
              maxLength={240}
              rows={2}
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="description" className={labelClass}>
              Description
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={product?.description ?? ""}
              required
              maxLength={5000}
              rows={5}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="highlights" className={labelClass}>
              Highlights
            </label>
            <textarea
              id="highlights"
              name="highlights"
              defaultValue={product?.highlights.join("\n") ?? ""}
              rows={4}
              placeholder="One highlight per line"
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="tags" className={labelClass}>
              Tags
            </label>
            <input
              id="tags"
              name="tags"
              defaultValue={product?.tags.join(", ") ?? ""}
              placeholder="audio, wireless, gift"
              className={inputClass}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          {product ? "Pricing" : "Pricing and inventory"}
        </h2>
        {product && (
          <p className="mt-2 text-sm text-muted">
            Stock is managed from{" "}
            <Link href="/admin/inventory" className="font-semibold text-accent hover:text-accent-strong">
              Inventory
            </Link>{" "}
            with a stale-data check and an audit trail, so saving product details
            cannot overwrite live stock.
          </p>
        )}
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="price" className={labelClass}>
              Price (USD)
            </label>
            <input
              id="price"
              name="price"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={dollars(product?.priceInCents)}
              required
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="compareAtPrice" className={labelClass}>
              Compare-at (USD)
            </label>
            <input
              id="compareAtPrice"
              name="compareAtPrice"
              type="number"
              min="0.01"
              step="0.01"
              defaultValue={dollars(product?.compareAtPriceInCents)}
              placeholder="Optional"
              className={inputClass}
            />
          </div>
          {!product && (
            <div>
              <label htmlFor="stock" className={labelClass}>
                Initial stock
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                min="0"
                step="1"
                defaultValue={20}
                required
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-muted-soft">
                Later changes must be made in Inventory.
              </p>
            </div>
          )}
          <div>
            <label htmlFor="badge" className={labelClass}>
              Badge
            </label>
            <select
              id="badge"
              name="badge"
              defaultValue={product?.badge ?? ""}
              className={inputClass}
            >
              <option value="">No badge</option>
              {PRODUCT_BADGES.map((badge) => (
                <option key={badge.value} value={badge.value}>
                  {badge.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-foreground">
          Category and media
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="categoryId" className={labelClass}>
              Category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.category?.id ?? ""}
              required
              className={inputClass}
            >
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="mt-1.5 text-xs text-danger">
                Create a category first.{" "}
                <Link href="/admin/categories" className="underline">
                  Manage categories
                </Link>
              </p>
            )}
          </div>
          <div>
            <label htmlFor="images" className={labelClass}>
              Images
            </label>
            <textarea
              id="images"
              name="images"
              defaultValue={product?.images.join("\n") ?? ""}
              rows={4}
              placeholder="/products/example.svg or https://..."
              className={inputClass}
            />
            <p className="mt-1.5 text-xs text-muted-soft">
              One local path or https URL per line. Maximum 6.
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-muted-strong">
            <input
              type="checkbox"
              name="featured"
              defaultChecked={product?.featured ?? false}
              className="h-4 w-4 rounded border-border-strong text-accent-bright focus:ring-accent"
            />
            Featured on the homepage
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-strong">
            <input
              type="checkbox"
              name="active"
              defaultChecked={product?.active ?? true}
              className="h-4 w-4 rounded border-border-strong text-accent-bright focus:ring-accent"
            />
            Active in the storefront
          </label>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting
            ? "Saving..."
            : product
              ? "Save product"
              : "Create product"}
        </button>
        <Link href="/admin/products" className={secondaryButtonClass}>
          Cancel
        </Link>
        {product?.active && (
          <button
            type="button"
            onClick={deactivate}
            disabled={isDeactivating}
            className="ml-auto rounded-full border border-danger-border px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
          >
            {isDeactivating ? "Deactivating..." : "Deactivate"}
          </button>
        )}
      </div>
    </form>
  );
}
