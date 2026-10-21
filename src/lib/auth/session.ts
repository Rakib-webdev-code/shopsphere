import { cache } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { ObjectId } from "mongodb";
import { auth } from "@/lib/auth";
import { usersCollection } from "@/lib/db/collections";
import { forbidden, unauthorized } from "@/lib/errors";
import type { UserRole } from "@/lib/types";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  phone: string | null;
  role: UserRole;
  createdAt: string;
};

function userFilter(id: string) {
  return ObjectId.isValid(id)
    ? { _id: new ObjectId(id) }
    : { _id: id as unknown as ObjectId };
}

export const getCurrentSession = cache(async () => {
  const requestHeaders = await headers();
  return auth.api.getSession({ headers: requestHeaders });
});

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  await connection();
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    return null;
  }

  const userId = String(session.user.id);
  // Re-read the user record rather than trusting role data from a cookie.
  const user = await usersCollection.findOne(userFilter(userId));

  if (!user) {
    return null;
  }

  return {
    id: userId,
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    image: user.image ?? null,
    phone: user.phone ?? null,
    role: user.role === "admin" ? "admin" : "customer",
    createdAt:
      user.createdAt instanceof Date
        ? user.createdAt.toISOString()
        : new Date(user.createdAt).toISOString(),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    throw unauthorized();
  }

  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();

  if (user.role !== "admin") {
    throw forbidden("Administrator access is required.");
  }

  return user;
}

/**
 * Page-level authorization for `/admin/*`.
 *
 * The admin layout gate alone is not sufficient: Next.js can render a page in
 * parallel with its layout, so admin page data may be streamed before the
 * layout rejects a non-admin. Every admin page calls this before reading data.
 */
export async function requireAdminPage(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?next=%2Fadmin");
  }

  if (user.role !== "admin") {
    notFound();
  }

  return user;
}
