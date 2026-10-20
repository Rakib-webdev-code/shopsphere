import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getProfileForUser } from "@/lib/services/profile";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const profile = await getProfileForUser(user.id);

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Account settings
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Update the name, phone number, and avatar shown with your reviews and
          orders. Your role is managed by an administrator.
        </p>
      </div>

      <div className="mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <ProfileForm initialProfile={profile} />
      </div>

      <div className="mt-6 max-w-2xl rounded-2xl border border-border bg-surface-muted p-5 text-sm leading-6 text-muted">
        Need to change your password or linked social account? Use the
        authentication provider you signed up with. ShopSphere never stores plain
        passwords in its own collections.{" "}
        <Link
          href="/account/addresses"
          className="font-semibold text-accent underline"
        >
          Manage addresses
        </Link>
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-28 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-9 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 h-96 max-w-2xl animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
