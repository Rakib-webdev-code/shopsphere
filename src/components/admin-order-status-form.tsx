"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TRANSITIONS,
} from "@/lib/constants";
import type { Order, OrderStatus } from "@/lib/types";

export function AdminOrderStatusForm({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus | "">(
    ORDER_STATUS_TRANSITIONS[order.status][0] ?? "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const nextStatuses = ORDER_STATUS_TRANSITIONS[order.status];

  async function handleSubmit() {
    if (!status) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest<{ order: Order }>(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage("Order status updated.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the order status.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-muted">
        This order is {ORDER_STATUS_LABELS[order.status].toLowerCase()} and has no
        further status transitions.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <label htmlFor="order-status" className="block text-sm font-medium text-muted-strong">
        Change status
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id="order-status"
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderStatus)}
          disabled={isSubmitting}
          className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
        >
          {nextStatuses.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>
              {ORDER_STATUS_LABELS[nextStatus]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !status}
          className="rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-solid-hover disabled:opacity-60"
        >
          {isSubmitting ? "Updating..." : "Update status"}
        </button>
      </div>
      {status === "cancelled" && (
        <p className="text-xs leading-5 text-warning">
          Cancelling releases reserved stock and returns coupon usage. This cannot
          be undone from the dashboard.
        </p>
      )}
    </div>
  );
}
