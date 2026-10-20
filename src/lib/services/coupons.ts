import { ObjectId } from "mongodb";
import { couponsCollection } from "@/lib/db/collections";
import type { CouponDoc } from "@/lib/db/types";
import { notFound, ValidationError } from "@/lib/errors";
import type { Coupon, CouponPreview, CouponType } from "@/lib/types";
import {
  asRecord,
  parseDateInput,
  parseObjectId,
  readBoolean,
  readEnum,
  readInt,
  readOptionalString,
  readString,
} from "@/lib/validation";

export function serializeCoupon(coupon: CouponDoc): Coupon {
  return {
    id: coupon._id.toHexString(),
    code: coupon.code,
    description: coupon.description,
    type: coupon.type,
    value: coupon.value,
    minSubtotalCents: coupon.minSubtotalCents,
    maxUses: coupon.maxUses ?? null,
    usedCount: coupon.usedCount,
    expiresAt: coupon.expiresAt ? coupon.expiresAt.toISOString() : null,
    active: Boolean(coupon.active),
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase();
}

export function calculateCouponDiscount(
  coupon: Pick<CouponDoc, "type" | "value">,
  subtotalCents: number,
): number {
  if (coupon.type === "percentage") {
    return Math.min(
      subtotalCents,
      Math.round((subtotalCents * coupon.value) / 100),
    );
  }

  return Math.min(subtotalCents, coupon.value);
}

export function assertCouponEligible(
  coupon: CouponDoc,
  subtotalCents: number,
  now = new Date(),
) {
  if (!coupon.active) {
    throw new ValidationError("This coupon is not active.");
  }

  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime()) {
    throw new ValidationError("This coupon has expired.");
  }

  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
    throw new ValidationError("This coupon has reached its usage limit.");
  }

  if (subtotalCents < coupon.minSubtotalCents) {
    throw new ValidationError(
      `This coupon requires a subtotal of at least $${(coupon.minSubtotalCents / 100).toFixed(2)}.`,
    );
  }
}

export async function validateCoupon(
  codeValue: string,
  subtotalCents: number,
): Promise<CouponPreview> {
  const code = normalizeCouponCode(codeValue);

  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    throw new ValidationError("Coupon code is not valid.");
  }

  const coupon = await couponsCollection.findOne({ code });

  if (!coupon) {
    throw new ValidationError("Coupon code was not found.");
  }

  assertCouponEligible(coupon, subtotalCents);

  return {
    coupon: serializeCoupon(coupon),
    discountCents: calculateCouponDiscount(coupon, subtotalCents),
  };
}

type CouponFields = Omit<CouponDoc, "_id" | "usedCount" | "createdAt" | "updatedAt">;

function parseCouponFields(
  rawValue: unknown,
  existing?: CouponDoc,
): CouponFields {
  const raw = asRecord(rawValue);
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(raw, key);

  const type: CouponType = has("type")
    ? readEnum(raw.type, ["percentage", "fixed"] as const, "Coupon type")
    : (existing?.type ?? "percentage");
  const value = has("value")
    ? readInt(raw.value, {
        label: "Coupon value",
        min: 1,
        max: type === "percentage" ? 100 : 10_000_000,
      })
    : existing?.value;

  if (value === undefined) {
    throw new ValidationError("Coupon value is required.");
  }

  if (existing && existing.usedCount > 0 && has("type") && type !== existing.type) {
    throw new ValidationError(
      "Coupon type cannot be changed after the coupon has been used.",
    );
  }

  const maxUses = has("maxUses")
    ? raw.maxUses === null || raw.maxUses === ""
      ? null
      : readInt(raw.maxUses, {
          label: "Maximum uses",
          min: 1,
          max: 1_000_000,
        })
    : (existing?.maxUses ?? null);

  if (existing && maxUses !== null && maxUses < existing.usedCount) {
    throw new ValidationError(
      "Maximum uses cannot be lower than the number of times the coupon has been used.",
    );
  }

  return {
    code: has("code")
      ? normalizeCouponCode(
          readString(raw.code, {
            label: "Coupon code",
            min: 3,
            max: 30,
            pattern: /^[A-Za-z0-9_-]+$/,
            patternMessage:
              "Coupon code can use letters, numbers, underscores, and dashes.",
          }),
        )
      : (existing?.code ?? ""),
    description: has("description")
      ? readString(raw.description, {
          label: "Description",
          max: 200,
        })
      : (existing?.description ?? ""),
    type,
    value,
    minSubtotalCents: has("minSubtotalCents")
      ? readInt(raw.minSubtotalCents, {
          label: "Minimum subtotal",
          min: 0,
          max: 10_000_000,
        })
      : (existing?.minSubtotalCents ?? 0),
    maxUses,
    expiresAt: has("expiresAt")
      ? parseDateInput(raw.expiresAt, "Expiry date")
      : (existing?.expiresAt ?? null),
    active: has("active")
      ? readBoolean(raw.active, "Active")
      : (existing?.active ?? true),
  };
}

export async function listCoupons(): Promise<Coupon[]> {
  const coupons = await couponsCollection
    .find({})
    .sort({ active: -1, createdAt: -1 })
    .toArray();

  return coupons.map(serializeCoupon);
}

export async function getCouponById(id: string): Promise<Coupon | null> {
  const coupon = await couponsCollection.findOne({
    _id: parseObjectId(id, "Coupon ID"),
  });

  return coupon ? serializeCoupon(coupon) : null;
}

export async function createCoupon(raw: unknown): Promise<Coupon> {
  const fields = parseCouponFields(raw);
  const now = new Date();
  const document: CouponDoc = {
    _id: new ObjectId(),
    ...fields,
    usedCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await couponsCollection.insertOne(document);
  return serializeCoupon(document);
}

export async function updateCoupon(
  id: string,
  raw: unknown,
): Promise<Coupon> {
  const couponId = parseObjectId(id, "Coupon ID");
  const existing = await couponsCollection.findOne({ _id: couponId });

  if (!existing) {
    throw notFound("Coupon not found.");
  }

  const fields = parseCouponFields(raw, existing);
  const updatedAt = new Date();

  await couponsCollection.updateOne(
    { _id: couponId },
    { $set: { ...fields, updatedAt } },
  );

  const updated = await couponsCollection.findOne({ _id: couponId });

  return serializeCoupon(updated ?? existing);
}

export async function setCouponActive(
  id: string,
  active: boolean,
): Promise<Coupon> {
  return updateCoupon(id, { active });
}

export async function deleteOrDeactivateCoupon(id: string) {
  return setCouponActive(id, false);
}

export async function readCouponPreview(
  code: unknown,
  subtotalCents: number,
): Promise<CouponPreview> {
  const parsedCode = readOptionalString(code, {
    label: "Coupon code",
    max: 30,
  });

  if (!parsedCode) {
    throw new ValidationError("Coupon code is required.");
  }

  return validateCoupon(parsedCode, subtotalCents);
}
