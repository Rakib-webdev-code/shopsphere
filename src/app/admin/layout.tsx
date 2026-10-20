import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { ShieldIcon } from "@/components/icons";
import { SectionNav } from "@/components/section-nav";
import { StorefrontShell } from "@/components/storefront-shell";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s · ShopSphere Admin",
  },
  robots: { index: false, follow: false },
};

const adminLinks = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/inventory", label: "Inventory" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/customers", label: "Customers" },
  { href: "/admin/coupons", label: "Coupons" },
] as const;

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <StorefrontShell>
      <Suspense fallback={<AdminLoading />}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </StorefrontShell>
  );
}

async function AdminGate({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/sign-in?next=%2Fadmin");
  }

  if (user.role !== "admin") {
    notFound();
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            <ShieldIcon className="h-4 w-4" />
            Administrator
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            ShopSphere admin
          </h1>
          <p className="mt-1 text-sm text-muted-soft">
            Signed in as {user.email}
          </p>
        </div>
        <Link
          href="/"
          className="w-fit rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          View store
        </Link>
      </div>

      <SectionNav
        links={adminLinks}
        ariaLabel="Admin navigation"
        className="mt-5"
      />

      <div className="mt-8 min-w-0">{children}</div>
    </div>
  );
}

function AdminLoading() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      aria-hidden="true"
    >
      <div className="h-24 animate-pulse rounded-2xl bg-surface-subtle" />
      <div className="mt-6 h-10 w-2/3 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
