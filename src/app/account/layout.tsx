import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { SectionNav } from "@/components/section-nav";
import { StorefrontShell } from "@/components/storefront-shell";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

const accountLinks = [
  { href: "/account", label: "Overview", exact: true },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/cart", label: "Cart" },
] as const;

export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <StorefrontShell>
      <Suspense fallback={<AccountLoading />}>
        <AccountGate>{children}</AccountGate>
      </Suspense>
    </StorefrontShell>
  );
}

async function AccountGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?next=%2Faccount");
  }

  const links = user.role === "admin"
    ? [
        ...accountLinks,
        { href: "/admin", label: "Admin dashboard", emphasis: true },
      ]
    : accountLinks;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        <aside>
          <div className="rounded-2xl border border-border bg-surface-muted p-4">
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-soft">
              Signed in as
            </p>
            <p className="mt-1 truncate px-2 text-sm font-semibold text-foreground">
              {user.name}
            </p>
            <p className="truncate px-2 text-xs text-muted-soft">{user.email}</p>

            <SectionNav
              links={links}
              ariaLabel="Account navigation"
              variant="sidebar"
              className="mt-4"
            />
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

function AccountLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-hidden="true">
      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="h-64 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
