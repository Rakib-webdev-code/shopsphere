"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { CartItem } from "@/lib/types";

export function CartLineControls({ item }: { item: CartItem }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const maxQuantity = Math.max(1, item.stock);

  async function update(nextQuantity: number) {
    if (nextQuantity < 0 || nextQuantity > maxQuantity) {
      return;
    }

    setError(null);
    setIsUpdating(true);

    try {
      await apiRequest(`/api/cart/items/${item.productId}`, {
        method: "PATCH",
        body: JSON.stringify({ quantity: nextQuantity }),
      });
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        router.push("/sign-in?next=%2Fcart");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the cart.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  async function remove() {
    setError(null);
    setIsUpdating(true);

    try {
      await apiRequest(`/api/cart/items/${item.productId}`, {
        method: "DELETE",
      });
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this item.",
      );
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="inline-flex items-center rounded-full border border-border-strong bg-surface">
        <button
          type="button"
          onClick={() => update(item.quantity - 1)}
          disabled={isUpdating || item.quantity <= 1 || !item.active}
          aria-label={`Decrease quantity of ${item.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40"
        >
          <MinusIcon />
        </button>
        <span
          aria-live="polite"
          className="min-w-8 text-center text-sm font-semibold text-foreground"
        >
          {item.quantity}
        </span>
        <button
          type="button"
          onClick={() => update(item.quantity + 1)}
          disabled={
            isUpdating || item.quantity >= maxQuantity || !item.active
          }
          aria-label={`Increase quantity of ${item.name}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-40"
        >
          <PlusIcon />
        </button>
      </div>

      <button
        type="button"
        onClick={remove}
        disabled={isUpdating}
        className="inline-flex items-center gap-1.5 rounded-full text-xs font-semibold text-muted-soft transition-colors hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Remove
      </button>

      {!item.active && (
        <span className="text-xs font-semibold text-danger">
          No longer available
        </span>
      )}
      {item.active && item.stock < item.quantity && (
        <span className="text-xs font-semibold text-warning">
          Only {item.stock} available
        </span>
      )}
      {error && (
        <p role="alert" className="w-full text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
