"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CartIcon } from "@/components/icons";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { MAX_QUANTITY } from "@/lib/constants";
import type { Cart } from "@/lib/types";

type AddToCartFormProps = {
  productId: string;
  stock: number;
};

export function AddToCartForm({ productId, stock }: AddToCartFormProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const maxQuantity = Math.min(stock, MAX_QUANTITY);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await apiRequest<{ cart: Cart }>("/api/cart/items", {
        method: "POST",
        body: JSON.stringify({ productId, quantity }),
      });
      setMessage("Added to your cart.");
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        router.push(
          `/sign-in?next=${encodeURIComponent(window.location.pathname)}`,
        );
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to add this product to your cart.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (stock === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface-muted px-5 py-4 text-sm text-muted">
        This product is currently out of stock. Add it to your wishlist and check
        back later.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-muted-strong">
          Quantity
          <select
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            disabled={isSubmitting}
            className="mt-1.5 block rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
          >
            {Array.from({ length: maxQuantity }, (_, index) => index + 1).map(
              (value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ),
            )}
          </select>
        </label>

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-accent-solid px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none"
        >
          <CartIcon className="h-4 w-4" />
          {isSubmitting ? "Adding..." : "Add to cart"}
        </button>
      </div>

      {message && (
        <p role="status" className="text-sm text-accent">
          {message}{" "}
          <Link href="/cart" className="font-semibold underline">
            View cart
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
