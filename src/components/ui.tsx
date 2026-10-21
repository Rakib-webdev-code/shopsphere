import Link from "next/link";
import type { ReactNode } from "react";
import { LOW_STOCK_THRESHOLD } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";

export const inputClass =
  "mt-1.5 w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-soft focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-muted-soft";
export const labelClass = "block text-sm font-medium text-muted-strong";

export const primaryButtonClass =
  "inline-flex items-center justify-center rounded-full bg-accent-solid px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const dangerButtonClass =
  "inline-flex items-center justify-center rounded-full border border-danger-border bg-surface px-4 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const iconButtonClass =
  "h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-strong transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

type AlertProps = {
  tone?: "info" | "success" | "error";
  children: ReactNode;
};

const alertClasses = {
  info: "border-accent-border bg-accent-soft text-accent-strong",
  success: "border-accent-border bg-accent-soft text-accent-strong",
  error: "border-danger-border bg-danger-soft text-danger",
} as const;

export function Alert({ tone = "info", children }: AlertProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm leading-6 ${alertClasses[tone]}`}
    >
      {children}
    </div>
  );
}

type PaginationProps = {
  basePath: string;
  page: number;
  totalPages: number;
  params?: Record<string, string | undefined>;
};

export function Pagination({
  basePath,
  page,
  totalPages,
  params = {},
}: PaginationProps) {
  if (totalPages <= 1) {
    return null;
  }

  function href(nextPage: number) {
    const search = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (value) {
        search.set(key, value);
      }
    }

    search.set("page", String(nextPage));
    return `${basePath}?${search.toString()}`;
  }

  return (
    <nav
      aria-label="Pagination"
      className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6"
    >
      <p className="text-sm text-muted">
        Page <span className="font-semibold text-foreground">{page}</span> of{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className={secondaryButtonClass}>
            Previous
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${secondaryButtonClass} pointer-events-none opacity-40`}
          >
            Previous
          </span>
        )}
        {page < totalPages ? (
          <Link href={href(page + 1)} className={primaryButtonClass}>
            Next
          </Link>
        ) : (
          <span
            aria-disabled="true"
            className={`${primaryButtonClass} pointer-events-none opacity-40`}
          >
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

const statusClasses: Record<OrderStatus, string> = {
  pending: "bg-warning-soft text-warning ring-warning-border",
  confirmed: "bg-accent-soft text-accent-strong ring-accent-border",
  processing: "bg-info-soft text-info ring-info-border",
  shipped: "bg-shipped-soft text-shipped ring-shipped-border",
  delivered: "bg-accent-soft text-accent-strong ring-accent-border",
  cancelled: "bg-surface-subtle text-muted ring-border",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ${statusClasses[status]}`}
    >
      {status}
    </span>
  );
}

export function StockStatusBadge({
  stock,
  threshold = LOW_STOCK_THRESHOLD,
}: {
  stock: number;
  threshold?: number;
}) {
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= threshold;
  const label = isOutOfStock
    ? "Out of stock"
    : isLowStock
      ? "Low stock"
      : "In stock";
  const tone = isOutOfStock
    ? "bg-danger-soft text-danger ring-danger-border"
    : isLowStock
      ? "bg-warning-soft text-warning ring-warning-border"
      : "bg-accent-soft text-accent-strong ring-accent-border";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${tone}`}
    >
      {label}
    </span>
  );
}
