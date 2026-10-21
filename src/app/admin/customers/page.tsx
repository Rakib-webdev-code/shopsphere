import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Alert, inputClass } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { formatPrice } from "@/lib/format";
import { listCustomerSummaries } from "@/lib/services/admin";

export const metadata: Metadata = { title: "Customers" };

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function AdminCustomersPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<CustomersSkeleton />}>
      <CustomersContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CustomersContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  await requireAdminPage();
  const params = await searchParams;
  const q = (firstValue(params.q) ?? "").trim().toLowerCase();

  let customers;

  try {
    customers = await listCustomerSummaries();
  } catch {
    return <Alert tone="error">Customers could not be loaded.</Alert>;
  }

  const filtered = q
    ? customers.filter(
        (customer) =>
          customer.name.toLowerCase().includes(q) ||
          customer.email.toLowerCase().includes(q),
      )
    : customers;
  const buyers = customers.filter((customer) => customer.orderCount > 0);
  const totalSpent = customers.reduce(
    (total, customer) => total + customer.totalSpentCents,
    0,
  );

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Customers
        </h2>
        <p className="mt-1.5 text-sm text-muted">
          Registered Better Auth users. Roles are read from MongoDB and are never
          assigned through public sign-up.
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-soft">
            Registered users
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">{customers.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-soft">
            Customers with orders
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">{buyers.length}</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-soft">
            Customer spend
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {formatPrice(totalSpent)}
          </p>
        </div>
      </div>

      <form
        action="/admin/customers"
        method="get"
        className="mt-6 flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label htmlFor="customer-query" className="text-xs font-semibold text-muted">
            Search by name or email
          </label>
          <input
            id="customer-query"
            name="q"
            defaultValue={q}
            className={inputClass}
            placeholder="customer@example.com"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-strong px-5 py-2.5 text-sm font-semibold text-strong-foreground hover:bg-strong/90"
        >
          Search
        </button>
        <Link
          href="/admin/customers"
          className="pb-2.5 text-sm font-semibold text-accent hover:text-accent-strong"
        >
          Reset
        </Link>
      </form>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border-strong bg-surface-muted px-6 py-14 text-center">
          <p className="text-lg font-semibold text-foreground">No customers found</p>
          <p className="mt-2 text-sm text-muted">
            Try a different search term.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Customer</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Orders</th>
                <th className="px-4 py-3 font-semibold">Total spent</th>
                <th className="px-4 py-3 font-semibold">Last order</th>
                <th className="px-4 py-3 font-semibold">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((customer) => (
                <tr key={customer.id} className="transition-colors hover:bg-surface-muted/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{customer.name}</p>
                    <p className="mt-0.5 break-all text-xs text-muted-soft">
                      {customer.email}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                        customer.role === "admin"
                          ? "bg-accent-soft text-accent-strong ring-accent-border"
                          : "bg-surface-subtle text-muted ring-border"
                      }`}
                    >
                      {customer.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {customer.orderCount > 0 ? (
                      <Link
                        href={`/admin/orders?q=${encodeURIComponent(customer.email)}`}
                        className="font-medium text-accent hover:text-accent-strong"
                      >
                        {customer.orderCount}
                      </Link>
                    ) : (
                      <span className="text-muted-soft">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-foreground">
                    {formatPrice(customer.totalSpentCents)}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {customer.lastOrderAt
                      ? new Date(customer.lastOrderAt).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(customer.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CustomersSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-40 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-surface-subtle" />
        ))}
      </div>
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
