"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PencilIcon, PlusIcon } from "@/components/icons";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import { PRODUCT_ICONS } from "@/lib/constants";
import type { Category } from "@/lib/types";

export function AdminCategoryManager({
  categories,
}: {
  categories: Category[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = editing === "new" ? null : editing;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const isNew = editing === "new";
      const payload = {
        name: String(data.get("name") ?? ""),
        slug: String(data.get("slug") ?? ""),
        tagline: String(data.get("tagline") ?? ""),
        description: String(data.get("description") ?? ""),
        icon: String(data.get("icon") ?? "backpack"),
        imageUrl: String(data.get("imageUrl") ?? "") || null,
        active: data.get("active") === "on",
      };

      await apiRequest<{ category: Category }>(
        isNew ? "/api/admin/categories" : `/api/admin/categories/${(editing as Category).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setMessage(isNew ? "Category created." : "Category updated.");
      setEditing(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the category.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivate(category: Category) {
    if (
      !window.confirm(
        `Deactivate “${category.name}”? Products keep their category reference, but the category is hidden from the storefront.`,
      )
    ) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
      });
      setMessage("Category deactivated.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to deactivate the category.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!editing && (
        <button
          type="button"
          onClick={() => {
            setEditing("new");
            setMessage(null);
          }}
          className={primaryButtonClass}
        >
          <PlusIcon className="mr-2" />
          New category
        </button>
      )}

      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-foreground">
            {editing === "new" ? "New category" : `Edit ${current?.name}`}
          </h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="category-name" className={labelClass}>
                Name
              </label>
              <input
                id="category-name"
                name="name"
                defaultValue={current?.name ?? ""}
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="category-slug" className={labelClass}>
                Slug
              </label>
              <input
                id="category-slug"
                name="slug"
                defaultValue={current?.slug ?? ""}
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="category-tagline" className={labelClass}>
                Tagline
              </label>
              <input
                id="category-tagline"
                name="tagline"
                defaultValue={current?.tagline ?? ""}
                required
                maxLength={140}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="category-description" className={labelClass}>
                Description
              </label>
              <textarea
                id="category-description"
                name="description"
                defaultValue={current?.description ?? ""}
                required
                maxLength={1000}
                rows={4}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="category-icon" className={labelClass}>
                Icon
              </label>
              <select
                id="category-icon"
                name="icon"
                defaultValue={current?.icon ?? "backpack"}
                className={inputClass}
              >
                {PRODUCT_ICONS.map((icon) => (
                  <option key={icon.value} value={icon.value}>
                    {icon.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="category-image" className={labelClass}>
                Image URL{" "}
                <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                id="category-image"
                name="imageUrl"
                defaultValue={current?.imageUrl ?? ""}
                maxLength={1000}
                placeholder="/images/category.svg or https://..."
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-strong">
              <input
                type="checkbox"
                name="active"
                defaultChecked={current?.active ?? true}
                className="h-4 w-4 rounded border-border-strong text-accent-bright focus:ring-accent"
              />
              Active in the storefront
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
              {isSubmitting ? "Saving..." : "Save category"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">No categories yet</p>
          <p className="mt-2 text-sm text-muted">
            Create a category before adding products.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {categories.map((category) => (
            <article
              key={category.id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    {category.name}
                  </h3>
                  <p className="mt-1 text-xs text-muted-soft">
                    /categories/{category.slug} · {category.productCount} active{" "}
                    {category.productCount === 1 ? "product" : "products"}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    category.active
                      ? "bg-accent-soft text-accent-strong ring-accent-border"
                      : "bg-surface-subtle text-muted ring-border"
                  }`}
                >
                  {category.active ? "Active" : "Inactive"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {category.tagline}
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(category);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
                {category.active && (
                  <button
                    type="button"
                    onClick={() => deactivate(category)}
                    disabled={isSubmitting}
                    className="text-xs font-semibold text-muted-soft hover:text-danger disabled:opacity-60"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
