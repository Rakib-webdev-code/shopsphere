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
import { formatPrice } from "@/lib/format";
import type { Coupon } from "@/lib/types";

function valueLabel(coupon: Coupon) {
  return coupon.type === "percentage"
    ? `${coupon.value}%`
    : formatPrice(coupon.value);
}

export function AdminCouponManager({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Coupon | "new" | null>(null);
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const current = editing === "new" ? null : editing;

  function startNew() {
    setType("percentage");
    setEditing("new");
    setMessage(null);
  }

  function startEdit(coupon: Coupon) {
    setType(coupon.type);
    setEditing(coupon);
    setMessage(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const isNew = editing === "new";
      const rawValue = Number(data.get("value") ?? 0);
      const rawMinSubtotal = Number(data.get("minSubtotal") ?? 0);
      const rawMaxUses = String(data.get("maxUses") ?? "").trim();
      const value =
        type === "fixed" ? Math.round(rawValue * 100) : Math.round(rawValue);
      const minSubtotalCents = Math.round(rawMinSubtotal * 100);

      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Enter a discount value greater than zero.");
      }

      if (!Number.isFinite(minSubtotalCents) || minSubtotalCents < 0) {
        throw new Error("Minimum subtotal must be zero or more.");
      }

      const payload = {
        code: String(data.get("code") ?? ""),
        description: String(data.get("description") ?? ""),
        type,
        value,
        minSubtotalCents,
        maxUses: rawMaxUses ? Number(rawMaxUses) : null,
        expiresAt: String(data.get("expiresAt") ?? ""),
        active: data.get("active") === "on",
      };

      await apiRequest<{ coupon: Coupon }>(
        isNew ? "/api/admin/coupons" : `/api/admin/coupons/${(editing as Coupon).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify(payload),
        },
      );
      setMessage(isNew ? "Coupon created." : "Coupon updated.");
      setEditing(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save the coupon.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivate(coupon: Coupon) {
    if (!window.confirm(`Deactivate coupon ${coupon.code}?`)) {
      return;
    }

    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/admin/coupons/${coupon.id}`, { method: "DELETE" });
      setMessage("Coupon deactivated.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to deactivate the coupon.",
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
        <button type="button" onClick={startNew} className={primaryButtonClass}>
          <PlusIcon className="mr-2" />
          New coupon
        </button>
      )}

      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-5 sm:p-6"
        >
          <h3 className="text-lg font-semibold text-foreground">
            {editing === "new" ? "New coupon" : `Edit ${current?.code}`}
          </h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="coupon-code" className={labelClass}>
                Code
              </label>
              <input
                id="coupon-code"
                name="code"
                defaultValue={current?.code ?? ""}
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_-]+"
                className={`${inputClass} uppercase`}
              />
            </div>
            <div>
              <label htmlFor="coupon-type" className={labelClass}>
                Type
              </label>
              <select
                id="coupon-type"
                name="type"
                value={type}
                onChange={(event) =>
                  setType(event.target.value as "percentage" | "fixed")
                }
                className={inputClass}
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed amount (USD)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="coupon-description" className={labelClass}>
                Description
              </label>
              <input
                id="coupon-description"
                name="description"
                defaultValue={current?.description ?? ""}
                required
                maxLength={200}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="coupon-value" className={labelClass}>
                {type === "percentage" ? "Percent off" : "Amount off (USD)"}
              </label>
              <input
                id="coupon-value"
                name="value"
                type="number"
                min={type === "percentage" ? "1" : "0.01"}
                max={type === "percentage" ? "100" : undefined}
                step={type === "percentage" ? "1" : "0.01"}
                defaultValue={
                  current
                    ? current.type === "percentage"
                      ? current.value
                      : dollars(current.value)
                    : ""
                }
                required
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="coupon-min-subtotal" className={labelClass}>
                Minimum subtotal (USD)
              </label>
              <input
                id="coupon-min-subtotal"
                name="minSubtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue={dollars(current?.minSubtotalCents ?? 0)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="coupon-max-uses" className={labelClass}>
                Maximum uses
              </label>
              <input
                id="coupon-max-uses"
                name="maxUses"
                type="number"
                min="1"
                step="1"
                defaultValue={current?.maxUses ?? ""}
                placeholder="Unlimited"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="coupon-expiry" className={labelClass}>
                Expiry date
              </label>
              <input
                id="coupon-expiry"
                name="expiresAt"
                type="date"
                defaultValue={current?.expiresAt?.slice(0, 10) ?? ""}
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
              Active
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
              {isSubmitting ? "Saving..." : "Save coupon"}
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

      {coupons.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">No coupons yet</p>
          <p className="mt-2 text-sm text-muted">
            Create a coupon to offer a percentage or fixed discount.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Discount</th>
                <th className="px-4 py-3 font-semibold">Minimum</th>
                <th className="px-4 py-3 font-semibold">Uses</th>
                <th className="px-4 py-3 font-semibold">Expires</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {coupons.map((coupon) => (
                <tr key={coupon.id} className="transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold tracking-wide text-foreground">
                      {coupon.code}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-soft">
                      {coupon.description}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {valueLabel(coupon)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {formatPrice(coupon.minSubtotalCents)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {coupon.usedCount} / {coupon.maxUses ?? "∞"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {coupon.expiresAt
                      ? new Date(coupon.expiresAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "No expiry"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        coupon.active
                          ? "bg-accent-soft text-accent-strong ring-accent-border"
                          : "bg-surface-subtle text-muted ring-border"
                      }`}
                    >
                      {coupon.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => startEdit(coupon)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
                      >
                        <PencilIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      {coupon.active && (
                        <button
                          type="button"
                          onClick={() => deactivate(coupon)}
                          disabled={isSubmitting}
                          className="text-xs font-semibold text-muted-soft hover:text-danger disabled:opacity-60"
                        >
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}
