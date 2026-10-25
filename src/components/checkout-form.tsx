"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, type FormEvent } from "react";
import { CheckIcon } from "@/components/icons";
import {
  Alert,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import {
  clearStoredCheckoutKey,
  resolveCheckoutKey,
  type CheckoutKeyStorage,
} from "@/lib/checkout-key";
import {
  FREE_SHIPPING_THRESHOLD_CENTS,
  SHIPPING_FEE_CENTS,
} from "@/lib/constants";
import { formatPrice } from "@/lib/format";
import type { Address, Cart, CouponPreview, Order } from "@/lib/types";

type CheckoutFormProps = {
  cart: Cart;
  addresses: Address[];
  userId: string;
  customerName: string;
};

function shippingPayload(form: HTMLFormElement) {
  const data = new FormData(form);

  return {
    fullName: String(data.get("fullName") ?? ""),
    line1: String(data.get("line1") ?? ""),
    line2: String(data.get("line2") ?? ""),
    city: String(data.get("city") ?? ""),
    state: String(data.get("state") ?? ""),
    postalCode: String(data.get("postalCode") ?? ""),
    country: String(data.get("country") ?? ""),
    phone: String(data.get("phone") ?? ""),
  };
}

function createCheckoutKey() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `checkout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function getCheckoutStorage(): CheckoutKeyStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    // Storage can be blocked (for example in some private-browsing modes).
    return null;
  }
}

export function CheckoutForm({
  cart,
  addresses,
  userId,
  customerName,
}: CheckoutFormProps) {
  const router = useRouter();
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0];
  const [useSaved, setUseSaved] = useState(Boolean(defaultAddress));
  const [addressId, setAddressId] = useState(defaultAddress?.id ?? "");
  const [couponCode, setCouponCode] = useState("");
  const [couponPreview, setCouponPreview] = useState<CouponPreview | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutKeyRef = useRef<string | null>(null);

  const discountCents = couponPreview?.discountCents ?? 0;
  const shippingCents =
    cart.subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS
      ? 0
      : SHIPPING_FEE_CENTS;
  const totalCents = Math.max(
    0,
    cart.subtotalCents - discountCents + shippingCents,
  );

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === addressId),
    [addresses, addressId],
  );

  async function applyCoupon() {
    setCouponError(null);
    setCouponPreview(null);
    setIsApplyingCoupon(true);

    try {
      const result = await apiRequest<{ preview: CouponPreview }>(
        "/api/coupons/validate",
        {
          method: "POST",
          body: JSON.stringify({ code: couponCode }),
        },
      );
      setCouponPreview(result.preview);
    } catch (requestError) {
      setCouponError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to validate this coupon.",
      );
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (useSaved && !addressId) {
      setError("Choose a saved address or enter a new one.");
      return;
    }

    setIsSubmitting(true);

    try {
      const form = event.currentTarget;
      const storage = getCheckoutStorage();
      const checkoutKey =
        checkoutKeyRef.current ??
        resolveCheckoutKey({
          storage,
          userId,
          cartRevision: cart.revision,
          createKey: createCheckoutKey,
        });
      checkoutKeyRef.current = checkoutKey;
      const body = useSaved
        ? {
            addressId,
            couponCode: couponPreview?.coupon.code ?? "",
            checkoutKey,
          }
        : {
            shipping: shippingPayload(form),
            couponCode: couponPreview?.coupon.code ?? "",
            checkoutKey,
          };
      const result = await apiRequest<{ order: Order }>("/api/checkout", {
        method: "POST",
        body: JSON.stringify(body),
      });
      // The checkout is definitively complete for this cart revision. Do not
      // reuse its key if the same revision is somehow rendered again.
      clearStoredCheckoutKey(storage, userId, cart.revision);
      checkoutKeyRef.current = null;
      router.push(`/account/orders/${result.order.id}?created=1`);
      router.refresh();
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.status === 401) {
        router.push("/sign-in?next=%2Fcheckout");
        return;
      }

      if (
        requestError instanceof ApiClientError &&
        requestError.code === "CHECKOUT_RETRY_REQUIRED"
      ) {
        // The server aborted the previous attempt and the key is spent for
        // this cart revision. The next click starts a fresh checkout.
        clearStoredCheckoutKey(getCheckoutStorage(), userId, cart.revision);
        checkoutKeyRef.current = null;
      }

      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to place your order.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Shipping address
          </h2>

          {addresses.length > 0 && (
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4 has-[:checked]:border-accent-bright has-[:checked]:bg-accent-soft/60">
                <input
                  type="radio"
                  name="addressMode"
                  checked={useSaved}
                  onChange={() => setUseSaved(true)}
                  className="mt-1 text-accent-bright focus:ring-accent"
                />
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    Use a saved address
                  </span>
                  {useSaved && (
                    <select
                      value={addressId}
                      onChange={(event) => setAddressId(event.target.value)}
                      className={inputClass}
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label} — {address.fullName}, {address.city}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              </label>

              {selectedAddress && useSaved && (
                <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm leading-6 text-muted">
                  <p className="font-medium text-muted-strong">
                    {selectedAddress.fullName}
                  </p>
                  <p>
                    {selectedAddress.line1}
                    {selectedAddress.line2 ? `, ${selectedAddress.line2}` : ""}
                    <br />
                    {selectedAddress.city}, {selectedAddress.state}{" "}
                    {selectedAddress.postalCode}
                    <br />
                    {selectedAddress.country}
                  </p>
                </div>
              )}

              <label className="flex cursor-pointer gap-3 rounded-2xl border border-border p-4 has-[:checked]:border-accent-bright has-[:checked]:bg-accent-soft/60">
                <input
                  type="radio"
                  name="addressMode"
                  checked={!useSaved}
                  onChange={() => setUseSaved(false)}
                  className="mt-1 text-accent-bright focus:ring-accent"
                />
                <span className="text-sm font-semibold text-foreground">
                  Enter a new address
                </span>
              </label>
            </div>
          )}

          {!useSaved && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="checkout-full-name" className={labelClass}>
                  Full name
                </label>
                <input
                  id="checkout-full-name"
                  name="fullName"
                  defaultValue={customerName}
                  required
                  maxLength={120}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-line1" className={labelClass}>
                  Address line 1
                </label>
                <input
                  id="checkout-line1"
                  name="line1"
                  required
                  minLength={3}
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-line2" className={labelClass}>
                  Address line 2{" "}
                  <span className="font-normal text-faint">(optional)</span>
                </label>
                <input
                  id="checkout-line2"
                  name="line2"
                  maxLength={200}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="checkout-city" className={labelClass}>
                  City
                </label>
                <input
                  id="checkout-city"
                  name="city"
                  required
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="checkout-state" className={labelClass}>
                  State or region
                </label>
                <input
                  id="checkout-state"
                  name="state"
                  required
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="checkout-postal" className={labelClass}>
                  Postal code
                </label>
                <input
                  id="checkout-postal"
                  name="postalCode"
                  required
                  minLength={2}
                  maxLength={20}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="checkout-country" className={labelClass}>
                  Country
                </label>
                <input
                  id="checkout-country"
                  name="country"
                  required
                  maxLength={80}
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="checkout-phone" className={labelClass}>
                  Phone{" "}
                  <span className="font-normal text-faint">(optional)</span>
                </label>
                <input
                  id="checkout-phone"
                  name="phone"
                  maxLength={40}
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {addresses.length === 0 && (
            <p className="mt-4 text-sm leading-6 text-muted-soft">
              You do not have a saved address yet. Enter one below, or{" "}
              <Link
                href="/account/addresses"
                className="font-semibold text-accent underline"
              >
                save an address
              </Link>{" "}
              for next time.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-foreground">
            Coupon and payment
          </h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={couponCode}
              onChange={(event) => setCouponCode(event.target.value)}
              placeholder="Coupon code"
              maxLength={30}
              className={`${inputClass} sm:mt-0`}
              aria-label="Coupon code"
            />
            <button
              type="button"
              onClick={applyCoupon}
              disabled={isApplyingCoupon || !couponCode.trim()}
              className={secondaryButtonClass}
            >
              {isApplyingCoupon ? "Checking..." : "Apply"}
            </button>
          </div>
          {couponError && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {couponError}
            </p>
          )}
          {couponPreview && (
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-accent">
              <CheckIcon className="h-4 w-4" />
              {couponPreview.coupon.code} applied:{" "}
              {formatPrice(couponPreview.discountCents)} off
            </p>
          )}

          <div className="mt-5 rounded-2xl border border-warning-border bg-warning-soft px-4 py-3 text-sm leading-6 text-warning">
            <p className="font-semibold">No payment is collected in this demo.</p>
            <p className="mt-1">
              Placing an order reserves inventory and records the order as
              unpaid. No card details are requested, stored, or charged.
            </p>
          </div>
        </section>

        {error && <Alert tone="error">{error}</Alert>}

        <button
          type="submit"
          disabled={isSubmitting || cart.hasUnavailableItems}
          className={`${primaryButtonClass} w-full sm:w-auto`}
        >
          {isSubmitting ? "Placing order..." : "Place order"}
        </button>
      </div>

      <aside className="h-fit rounded-2xl border border-border bg-surface-muted p-5 sm:p-6 lg:sticky lg:top-28">
        <h2 className="text-lg font-semibold text-foreground">Order summary</h2>
        <ul className="mt-4 space-y-3 border-b border-border pb-4">
          {cart.items.map((item) => (
            <li key={item.productId} className="flex justify-between gap-3 text-sm">
              <span className="text-muted">
                {item.name} <span className="text-faint">× {item.quantity}</span>
              </span>
              <span className="shrink-0 font-medium text-foreground">
                {formatPrice(item.lineTotalCents)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Subtotal</dt>
            <dd className="font-medium text-foreground">
              {formatPrice(cart.subtotalCents)}
            </dd>
          </div>
          {discountCents > 0 && (
            <div className="flex justify-between text-accent">
              <dt>Discount</dt>
              <dd>-{formatPrice(discountCents)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted">Shipping</dt>
            <dd className="font-medium text-foreground">
              {shippingCents === 0 ? "Free" : formatPrice(shippingCents)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-border pt-3 text-base font-bold text-foreground">
            <dt>Total</dt>
            <dd>{formatPrice(totalCents)}</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs leading-5 text-muted-soft">
          Free shipping on orders of {formatPrice(FREE_SHIPPING_THRESHOLD_CENTS)}{" "}
          or more.
        </p>
      </aside>
    </form>
  );
}
