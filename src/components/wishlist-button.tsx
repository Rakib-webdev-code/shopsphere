"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeartIcon } from "@/components/icons";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { Wishlist } from "@/lib/types";

export function WishlistButton({ productId }: { productId: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest<{ wishlist: Wishlist }>("/api/wishlist", {
        method: "POST",
        body: JSON.stringify({ productId }),
      });
      setSaved(true);
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
          : "Unable to save this product.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (saved) {
    return (
      <p className="text-sm text-accent">
        Saved to your wishlist.{" "}
        <Link href="/wishlist" className="font-semibold underline">
          View wishlist
        </Link>
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSubmitting}
        className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
      >
        <HeartIcon className="h-4 w-4" />
        {isSubmitting ? "Saving..." : "Save to wishlist"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
