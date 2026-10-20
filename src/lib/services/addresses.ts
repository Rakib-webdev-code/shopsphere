import { ObjectId } from "mongodb";
import { addressesCollection } from "@/lib/db/collections";
import type { AddressDoc } from "@/lib/db/types";
import { notFound, ValidationError } from "@/lib/errors";
import type { Address } from "@/lib/types";
import {
  asRecord,
  parseObjectId,
  readBoolean,
  readOptionalString,
  readString,
} from "@/lib/validation";

function serializeAddress(address: AddressDoc): Address {
  return {
    id: address._id.toHexString(),
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? null,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone ?? null,
    isDefault: Boolean(address.isDefault),
    createdAt: address.createdAt.toISOString(),
    updatedAt: address.updatedAt.toISOString(),
  };
}

export async function listAddresses(userId: string): Promise<Address[]> {
  const addresses = await addressesCollection
    .find({ userId })
    .sort({ isDefault: -1, createdAt: -1 })
    .toArray();

  return addresses.map(serializeAddress);
}

export async function getAddressForUser(
  userId: string,
  addressId: string,
): Promise<Address> {
  const address = await addressesCollection.findOne({
    _id: parseObjectId(addressId, "Address ID"),
    userId,
  });

  if (!address) {
    throw notFound("Address not found.");
  }

  return serializeAddress(address);
}

type AddressFields = Omit<AddressDoc, "_id" | "userId" | "createdAt" | "updatedAt">;

function parseAddressFields(
  rawValue: unknown,
  existing?: AddressDoc,
): AddressFields {
  const raw = asRecord(rawValue);
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(raw, key);
  const value = (key: keyof AddressFields) => {
    if (has(key)) {
      return raw[key];
    }

    return existing?.[key];
  };

  const phone = has("phone")
    ? readOptionalString(raw.phone, { label: "Phone", max: 40 })
    : (existing?.phone ?? null);

  validateAddressPhone(phone);

  return {
    label:
      value("label") === undefined
        ? "Home"
        : readString(value("label"), { label: "Label", max: 40 }),
    fullName: readString(value("fullName"), {
      label: "Full name",
      max: 120,
    }),
    line1: readString(value("line1"), {
      label: "Address line 1",
      min: 3,
      max: 200,
    }),
    line2: has("line2")
      ? readOptionalString(raw.line2, { label: "Address line 2", max: 200 })
      : (existing?.line2 ?? null),
    city: readString(value("city"), { label: "City", max: 80 }),
    state: readString(value("state"), { label: "State or region", max: 80 }),
    postalCode: readString(value("postalCode"), {
      label: "Postal code",
      min: 2,
      max: 20,
    }),
    country: readString(value("country"), {
      label: "Country",
      min: 2,
      max: 80,
    }),
    phone,
    isDefault: has("isDefault")
      ? readBoolean(raw.isDefault, "Default address")
      : (existing?.isDefault ?? false),
  };
}

export async function createAddress(
  userId: string,
  raw: unknown,
): Promise<Address> {
  const fields = parseAddressFields(raw);
  const count = await addressesCollection.countDocuments({ userId });
  const isDefault = fields.isDefault || count === 0;
  const now = new Date();

  if (isDefault) {
    await addressesCollection.updateMany(
      { userId },
      { $set: { isDefault: false, updatedAt: now } },
    );
  }

  const document: AddressDoc = {
    _id: new ObjectId(),
    userId,
    ...fields,
    isDefault,
    createdAt: now,
    updatedAt: now,
  };

  await addressesCollection.insertOne(document);
  return serializeAddress(document);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  raw: unknown,
): Promise<Address> {
  const id = parseObjectId(addressId, "Address ID");
  const existing = await addressesCollection.findOne({ _id: id, userId });

  if (!existing) {
    throw notFound("Address not found.");
  }

  const fields = parseAddressFields(raw, existing);
  const now = new Date();

  if (fields.isDefault) {
    await addressesCollection.updateMany(
      { userId, _id: { $ne: id } },
      { $set: { isDefault: false, updatedAt: now } },
    );
  }

  await addressesCollection.updateOne(
    { _id: id, userId },
    { $set: { ...fields, updatedAt: now } },
  );

  const updated = await addressesCollection.findOne({ _id: id, userId });

  if (!updated) {
    throw notFound("Address not found.");
  }

  return serializeAddress(updated);
}

export async function deleteAddress(
  userId: string,
  addressId: string,
): Promise<void> {
  const id = parseObjectId(addressId, "Address ID");
  const existing = await addressesCollection.findOne({ _id: id, userId });

  if (!existing) {
    throw notFound("Address not found.");
  }

  await addressesCollection.deleteOne({ _id: id, userId });

  if (existing.isDefault) {
    const next = await addressesCollection.findOne(
      { userId },
      { sort: { createdAt: -1 } },
    );

    if (next) {
      await addressesCollection.updateOne(
        { _id: next._id, userId },
        { $set: { isDefault: true, updatedAt: new Date() } },
      );
    }
  }
}

export function addressToShipping(address: Address) {
  return {
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postalCode: address.postalCode,
    country: address.country,
    phone: address.phone,
  };
}

export function validateAddressPhone(phone: string | null) {
  if (phone && !/^[0-9+().\-\s]{6,40}$/.test(phone)) {
    throw new ValidationError("Phone number contains unsupported characters.");
  }
}
