import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderStatus, OrderStatusEvent } from "@/lib/types";

function formatTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function OrderStatusTimeline({
  history,
  createdAt,
  currentStatus,
}: {
  history: OrderStatusEvent[];
  createdAt: string;
  currentStatus: OrderStatus;
}) {
  const orderedHistory = [...history].sort(
    (left, right) =>
      new Date(left.changedAt).getTime() - new Date(right.changedAt).getTime(),
  );

  if (orderedHistory.length === 0) {
    return (
      <div className="mt-4 rounded-2xl border border-border bg-surface-muted px-4 py-4 text-sm leading-6 text-muted">
        <p className="font-semibold text-foreground">
          Current status: {ORDER_STATUS_LABELS[currentStatus]}
        </p>
        <p className="mt-1">
          Order placed {formatTimestamp(createdAt)}. Detailed status history was
          not recorded for this order.
        </p>
      </div>
    );
  }

  return (
    <ol className="mt-4" aria-label="Order status history">
      {orderedHistory.map((event, index) => {
        const isLast = index === orderedHistory.length - 1;
        const isCurrent = event.status === currentStatus && isLast;

        return (
          <li
            key={`${event.status}-${event.changedAt}-${index}`}
            className="relative flex gap-3 pb-6 last:pb-0"
          >
            {!isLast && (
              <span
                aria-hidden="true"
                className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-px bg-border"
              />
            )}
            <span
              className={`relative z-10 mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-1 ${
                isCurrent
                  ? "bg-accent-solid text-white ring-accent-solid"
                  : "bg-surface-subtle text-muted ring-border-strong"
              }`}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full bg-current"
              />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {ORDER_STATUS_LABELS[event.status]}
                </p>
                {isCurrent && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent-strong ring-1 ring-accent-border">
                    Current
                  </span>
                )}
              </div>
              <time
                dateTime={event.changedAt}
                className="mt-0.5 block text-xs text-muted-soft"
              >
                {formatTimestamp(event.changedAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
