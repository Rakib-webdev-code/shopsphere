"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, dangerButtonClass, secondaryButtonClass } from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import type { Order } from "@/lib/types";

type ReconciliationAction = "retry" | "force-release";

/**
 * Admin controls for an order whose inventory release could not finish.
 *
 * Retry is the safe first step after repairing the missing product or coupon.
 * Force-release is deliberately two-step: it fences every surviving inventory
 * document and records the acting admin, but deleted documents cannot be
 * restored, so the warning must be acknowledged.
 */
export function AdminOrderReconciliation({ order }: { order: Order }) {
  const router = useRouter();
  const [pending, setPending] = useState<ReconciliationAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canForceRelease =
    order.inventoryState === "reserving" ||
    order.inventoryState === "releasing";

  async function run(action: ReconciliationAction) {
    setMessage(null);
    setError(null);
    setPending(action);

    try {
      await apiRequest<{ order: Order }>(`/api/admin/orders/${order.id}`, {
        method: "PATCH",
        body: JSON.stringify({ reconciliationAction: action }),
      });
      setConfirming(false);
      setMessage(
        action === "retry"
          ? "Recovery retried. Refresh to review the latest inventory state."
          : "Force-release completed and the action was recorded.",
      );
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The reconciliation action could not be completed.",
      );
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void run("retry")}
          disabled={pending !== null}
          className={secondaryButtonClass}
        >
          {pending === "retry" ? "Retrying..." : "Retry recovery"}
        </button>

        {canForceRelease && !confirming && (
          <button
            type="button"
            onClick={() => {
              setMessage(null);
              setError(null);
              setConfirming(true);
            }}
            disabled={pending !== null}
            className={dangerButtonClass}
          >
            Force release inventory
          </button>
        )}
      </div>

      {confirming && canForceRelease && (
        <div className="rounded-xl border border-danger-border bg-danger-soft p-4">
          <p className="text-sm font-semibold text-danger">
            Confirm force release
          </p>
          <p className="mt-1 text-xs leading-5 text-danger">
            This fences every surviving inventory document and marks the order
            as released. If a product or coupon was deleted, its stock or usage
            cannot be reconstructed. Only continue after checking the order
            manually.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void run("force-release")}
              disabled={pending !== null}
              className={dangerButtonClass}
            >
              {pending === "force-release"
                ? "Releasing..."
                : "Yes, force release"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending !== null}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!canForceRelease && (
        <p className="text-xs leading-5 text-muted-soft">
          Force release is only available while inventory is reserving or
          releasing. This order is already {order.inventoryState}.
        </p>
      )}
    </div>
  );
}
