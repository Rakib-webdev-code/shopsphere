import { ObjectId } from "mongodb";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/db/collections";
import type { UserDoc } from "@/lib/db/types";
import { notFound, ValidationError } from "@/lib/errors";
import type { Profile, UserRole } from "@/lib/types";
import {
  asRecord,
  readOptionalString,
  readString,
  validateImageUrl,
} from "@/lib/validation";

function userFilter(id: string) {
  return ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { _id: id as unknown as ObjectId };
}

function serializeProfile(user: UserDoc | null): Profile {
  if (!user) {
    throw notFound("Profile not found.");
  }

  return {
    id: user._id.toHexString(),
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    image: user.image ?? null,
    phone: user.phone ?? null,
    role: (user.role === "admin" ? "admin" : "customer") as UserRole,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfileForUser(userId: string): Promise<Profile> {
  const user = await usersCollection.findOne(userFilter(userId));
  return serializeProfile(user);
}

export async function updateProfileForUser(
  userId: string,
  raw: unknown,
): Promise<Profile> {
  const body = asRecord(raw);
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(body, key);
  const current = await usersCollection.findOne(userFilter(userId));

  if (!current) {
    throw notFound("Profile not found.");
  }

  const name = has("name")
    ? readString(body.name, { label: "Name", max: 80 })
    : current.name;
  const image = has("image")
    ? body.image === null || body.image === ""
      ? null
      : validateImageUrl(body.image, "Avatar URL")
    : (current.image ?? null);
  const phone = has("phone")
    ? readOptionalString(body.phone, { label: "Phone", max: 40 })
    : (current.phone ?? null);

  if (phone && !/^[0-9+().\-\s]{6,40}$/.test(phone)) {
    throw new ValidationError("Phone number contains unsupported characters.");
  }

  const requestHeaders = await headers();

  await auth.api.updateUser({
    headers: requestHeaders,
    body: {
      name,
      image,
    },
  });

  await usersCollection.updateOne(
    userFilter(userId),
    { $set: { phone, updatedAt: new Date() } },
  );

  return getProfileForUser(userId);
}
