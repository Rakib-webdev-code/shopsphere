"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/icons";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import type { Address } from "@/lib/types";

type AddressManagerProps = {
  initialAddresses: Address[];
};

function addressPayload(form: HTMLFormElement) {
  const data = new FormData(form);

  return {
    label: String(data.get("label") ?? ""),
    fullName: String(data.get("fullName") ?? ""),
    line1: String(data.get("line1") ?? ""),
    line2: String(data.get("line2") ?? ""),
    city: String(data.get("city") ?? ""),
    state: String(data.get("state") ?? ""),
    postalCode: String(data.get("postalCode") ?? ""),
    country: String(data.get("country") ?? ""),
    phone: String(data.get("phone") ?? ""),
    isDefault: data.get("isDefault") === "on",
  };
}

export function AddressManager({ initialAddresses }: AddressManagerProps) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const isNew = editing === "new";
      await apiRequest<{ address: Address }>(
        isNew ? "/api/addresses" : `/api/addresses/${(editing as Address).id}`,
        {
          method: isNew ? "POST" : "PATCH",
          body: JSON.stringify(addressPayload(form)),
        },
      );
      setMessage(isNew ? "Address added." : "Address updated.");
      setEditing(null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save this address.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function remove(address: Address) {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await apiRequest(`/api/addresses/${address.id}`, { method: "DELETE" });
      setMessage("Address removed.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to remove this address.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function makeDefault(address: Address) {
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      await apiRequest<{ address: Address }>(`/api/addresses/${address.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: address.label,
          fullName: address.fullName,
          line1: address.line1,
          line2: address.line2 ?? "",
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
          phone: address.phone ?? "",
          isDefault: true,
        }),
      });
      setMessage("Default address updated.");
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to update the default address.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const current = editing === "new" ? null : editing;

  return (
    <div className="space-y-6">
      {message && <Alert tone="success">{message}</Alert>}
      {error && <Alert tone="error">{error}</Alert>}

      {!editing && (
        <button
          type="button"
          onClick={() => {
            setEditing("new");
            setMessage(null);
          }}
          className={primaryButtonClass}
        >
          <PlusIcon className="mr-2" />
          Add address
        </button>
      )}

      {editing && (
        <form
          key={editing === "new" ? "new" : editing.id}
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-6"
        >
          <h2 className="text-lg font-semibold text-foreground">
            {editing === "new" ? "New address" : "Edit address"}
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="address-label" className={labelClass}>
                Label
              </label>
              <input
                id="address-label"
                name="label"
                defaultValue={current?.label ?? "Home"}
                maxLength={40}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-full-name" className={labelClass}>
                Full name
              </label>
              <input
                id="address-full-name"
                name="fullName"
                defaultValue={current?.fullName ?? ""}
                required
                maxLength={120}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="address-line1" className={labelClass}>
                Address line 1
              </label>
              <input
                id="address-line1"
                name="line1"
                defaultValue={current?.line1 ?? ""}
                required
                minLength={3}
                maxLength={200}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="address-line2" className={labelClass}>
                Address line 2{" "}
                <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                id="address-line2"
                name="line2"
                defaultValue={current?.line2 ?? ""}
                maxLength={200}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-city" className={labelClass}>
                City
              </label>
              <input
                id="address-city"
                name="city"
                defaultValue={current?.city ?? ""}
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-state" className={labelClass}>
                State or region
              </label>
              <input
                id="address-state"
                name="state"
                defaultValue={current?.state ?? ""}
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-postal" className={labelClass}>
                Postal code
              </label>
              <input
                id="address-postal"
                name="postalCode"
                defaultValue={current?.postalCode ?? ""}
                required
                minLength={2}
                maxLength={20}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-country" className={labelClass}>
                Country
              </label>
              <input
                id="address-country"
                name="country"
                defaultValue={current?.country ?? ""}
                required
                maxLength={80}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="address-phone" className={labelClass}>
                Phone{" "}
                <span className="font-normal text-faint">(optional)</span>
              </label>
              <input
                id="address-phone"
                name="phone"
                defaultValue={current?.phone ?? ""}
                maxLength={40}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-muted-strong">
              <input
                type="checkbox"
                name="isDefault"
                defaultChecked={current?.isDefault ?? initialAddresses.length === 0}
                className="h-4 w-4 rounded border-border-strong text-accent-bright focus:ring-accent"
              />
              Make this the default address
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className={primaryButtonClass}
            >
              {isSubmitting ? "Saving..." : "Save address"}
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

      {initialAddresses.length === 0 && !editing ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-12 text-center">
          <h2 className="text-lg font-semibold text-foreground">
            No saved addresses yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
            Add an address to make checkout faster. You can still enter a new
            address during checkout.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {initialAddresses.map((address) => (
            <li
              key={address.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {address.label}
                  </p>
                  {address.isDefault && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-strong ring-1 ring-accent-border">
                      <CheckIcon className="h-3 w-3" />
                      Default
                    </span>
                  )}
                </div>
              </div>
              <address className="mt-3 text-sm not-italic leading-6 text-muted">
                <span className="block font-medium text-muted-strong">
                  {address.fullName}
                </span>
                {address.line1}
                {address.line2 ? `, ${address.line2}` : ""}
                <br />
                {address.city}, {address.state} {address.postalCode}
                <br />
                {address.country}
                {address.phone ? (
                  <>
                    <br />
                    {address.phone}
                  </>
                ) : null}
              </address>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(address);
                    setMessage(null);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
                >
                  <PencilIcon className="h-3.5 w-3.5" />
                  Edit
                </button>
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(address)}
                    disabled={isSubmitting}
                    className="text-xs font-semibold text-accent hover:text-accent-strong disabled:opacity-60"
                  >
                    Make default
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => remove(address)}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-soft hover:text-danger disabled:opacity-60"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
