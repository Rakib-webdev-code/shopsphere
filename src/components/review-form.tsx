"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import type { Review } from "@/lib/types";

type ReviewFormProps = {
  productSlug: string;
  existingReview?: Review;
};

export function ReviewForm({ productSlug, existingReview }: ReviewFormProps) {
  const router = useRouter();
  const [rating, setRating] = useState(existingReview?.rating ?? 5);
  const [title, setTitle] = useState(existingReview?.title ?? "");
  const [body, setBody] = useState(existingReview?.body ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const payload = { rating, title, body };
      await apiRequest<{ review: Review }>(
        existingReview
          ? `/api/reviews/${existingReview.id}`
          : `/api/products/${productSlug}/reviews`,
        {
          method: existingReview ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setMessage(existingReview ? "Review updated." : "Review published.");
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
          : "Unable to save your review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div>
          <label htmlFor="review-rating" className={labelClass}>
            Rating
          </label>
          <select
            id="review-rating"
            value={rating}
            onChange={(event) => setRating(Number(event.target.value))}
            className={inputClass}
          >
            {[5, 4, 3, 2, 1].map((value) => (
              <option key={value} value={value}>
                {value} star{value === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="review-title" className={labelClass}>
            Title{" "}
            <span className="font-normal text-faint">(optional)</span>
          </label>
          <input
            id="review-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="review-body" className={labelClass}>
          Your review
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-muted-soft">
          At least 10 characters. Reviews are public and cannot be edited by
          other customers.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className={primaryButtonClass}
        >
          {isSubmitting
            ? "Saving..."
            : existingReview
              ? "Update review"
              : "Publish review"}
        </button>
      </div>
    </form>
  );
}

export function DeleteReviewButton({ reviewId }: { reviewId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm("Delete your review? This cannot be undone.")) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/reviews/${reviewId}`, { method: "DELETE" });
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete your review.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleDelete}
        disabled={isSubmitting}
        className={secondaryButtonClass}
      >
        {isSubmitting ? "Deleting..." : "Delete review"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
