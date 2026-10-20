"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { ApiClientError, apiRequest } from "@/lib/api-client";

export function WishlistRemoveButton({
  productId,
}: {
  productId: string;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/wishlist/${productId}`, { method: "DELETE" });
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        router.push("/sign-in?next=%2Fwishlist");
        return;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this product.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isSubmitting}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-soft transition-colors hover:text-danger disabled:opacity-60"
      >
        <TrashIcon className="h-3.5 w-3.5" />
        {isSubmitting ? "Removing..." : "Remove"}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
