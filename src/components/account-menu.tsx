"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { UserIcon } from "@/components/icons";
import { signOut, useSession } from "@/lib/auth-client";

const menuItemClass =
  "block rounded-xl px-3 py-2 text-sm font-medium text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

export function AccountMenu() {
  const router = useRouter();
  const { data, isPending } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const user = data?.user;

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isPending) {
    return (
      <span
        aria-label="Loading account"
        className="hidden h-10 w-24 animate-pulse rounded-full bg-surface-subtle sm:block"
      />
    );
  }

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="hidden rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-muted-strong transition-colors hover:border-border-strong hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:inline-flex"
      >
        Sign in
      </Link>
    );
  }

  return (
    <details className="group relative hidden sm:block">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <UserIcon className="h-4 w-4 text-accent-bright" />
        <span className="max-w-24 truncate">
          {user.name?.split(" ")[0] || "Account"}
        </span>
      </summary>
      <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-border bg-surface p-2 shadow-xl shadow-black/10 dark:shadow-black/40">
        <p className="truncate px-3 py-2 text-xs text-muted-soft">
          {user.email}
        </p>
        <Link href="/account" className={menuItemClass}>
          Account overview
        </Link>
        <Link href="/account/orders" className={menuItemClass}>
          Orders
        </Link>
        <Link href="/account/addresses" className={menuItemClass}>
          Addresses
        </Link>
        <Link href="/wishlist" className={menuItemClass}>
          Wishlist
        </Link>
        {user.role === "admin" && (
          <Link
            href="/admin"
            className="block rounded-xl px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Admin dashboard
          </Link>
        )}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-1 block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {isSigningOut ? "Signing out..." : "Sign out"}
        </button>
      </div>
    </details>
  );
}
