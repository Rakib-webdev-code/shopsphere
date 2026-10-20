import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRightIcon,
  HeartIcon,
  PackageIcon,
  UserIcon,
} from "@/components/icons";
import { OrderStatusBadge } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { listAddresses } from "@/lib/services/addresses";
import { listOrdersForUser } from "@/lib/services/orders";
import { getProfileForUser } from "@/lib/services/profile";
import { getWishlistForUser } from "@/lib/services/wishlist";

export const metadata: Metadata = {
  title: "Account overview",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountOverviewSkeleton />}>
      <AccountOverview />
    </Suspense>
  );
}

async function AccountOverview() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const [profile, orders, addresses, wishlist] = await Promise.all([
    getProfileForUser(user.id),
    listOrdersForUser(user.id),
    listAddresses(user.id),
    getWishlistForUser(user.id),
  ]);
  const recentOrders = orders.slice(0, 3);
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0];
  const totalSpentCents = orders
    .filter((order) => order.status !== "cancelled")
    .reduce((total, order) => total + order.totalCents, 0);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Your account
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
            Welcome back, {profile.name.split(" ")[0] || "there"}.
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Review your details, saved addresses, wishlist, and recent orders.
          </p>
        </div>
        <Link
          href="/account/profile"
          className="w-fit rounded-full border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-muted-strong transition-colors hover:bg-surface-muted"
        >
          Edit profile
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Orders"
          value={String(orders.length)}
          detail={`${formatPrice(totalSpentCents)} not cancelled`}
          icon={<PackageIcon className="h-5 w-5" />}
          href="/account/orders"
        />
        <StatCard
          label="Saved addresses"
          value={String(addresses.length)}
          detail={defaultAddress ? `Default: ${defaultAddress.label}` : "None saved yet"}
          icon={<UserIcon className="h-5 w-5" />}
          href="/account/addresses"
        />
        <StatCard
          label="Wishlist"
          value={String(wishlist.products.length)}
          detail="Saved products"
          icon={<HeartIcon className="h-5 w-5" />}
          href="/wishlist"
        />
        <StatCard
          label="Account type"
          value={profile.role === "admin" ? "Admin" : "Customer"}
          detail={profile.email}
          icon={<UserIcon className="h-5 w-5" />}
          href="/account/profile"
        />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">
              Recent orders
            </h2>
            <Link
              href="/account/orders"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:text-accent-strong"
            >
              View all
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {recentOrders.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-5 py-10 text-center">
              <p className="text-sm font-semibold text-foreground">
                No orders yet
              </p>
              <p className="mt-1.5 text-sm leading-6 text-muted">
                When you place an order, its status and totals will appear here.
              </p>
              <Link
                href="/shop"
                className="mt-4 inline-flex rounded-full bg-accent-solid px-4 py-2 text-sm font-semibold text-white hover:bg-accent-solid-hover"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-4 transition-colors hover:text-accent"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {order.orderNumber}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-soft">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        · {order.itemCount}{" "}
                        {order.itemCount === 1 ? "item" : "items"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-sm font-semibold text-foreground">
                        {formatPrice(order.totalCents)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface-muted p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-foreground">
              Default address
            </h2>
            {defaultAddress ? (
              <address className="mt-3 text-sm not-italic leading-6 text-muted">
                <span className="block font-medium text-foreground">
                  {defaultAddress.fullName}
                </span>
                {defaultAddress.line1}
                {defaultAddress.line2 ? `, ${defaultAddress.line2}` : ""}
                <br />
                {defaultAddress.city}, {defaultAddress.state}{" "}
                {defaultAddress.postalCode}
                <br />
                {defaultAddress.country}
              </address>
            ) : (
              <p className="mt-3 text-sm leading-6 text-muted">
                Add an address to make checkout faster.
              </p>
            )}
            <Link
              href="/account/addresses"
              className="mt-4 inline-flex text-sm font-semibold text-accent hover:text-accent-strong"
            >
              Manage addresses
            </Link>
          </section>

          <section className="rounded-2xl border border-accent-border bg-accent-soft p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-accent-strong">
              Profile details
            </h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-accent-strong">Name</dt>
                <dd className="font-medium text-accent-strong">{profile.name}</dd>
              </div>
              <div>
                <dt className="text-accent-strong">Email</dt>
                <dd className="break-all font-medium text-accent-strong">
                  {profile.email}
                </dd>
              </div>
              <div>
                <dt className="text-accent-strong">Phone</dt>
                <dd className="font-medium text-accent-strong">
                  {profile.phone ?? "Not provided"}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-surface p-5 transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-lg hover:shadow-black/5 dark:shadow-black/30"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent ring-1 ring-accent-border">
        {icon}
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-soft">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
      <p className="mt-1 truncate text-xs text-muted-soft">{detail}</p>
    </Link>
  );
}

function AccountOverviewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-28 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-9 w-80 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-40 animate-pulse rounded-2xl bg-surface-subtle" />
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-80 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
