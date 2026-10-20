import type { Metadata } from "next";
import { Suspense } from "react";
import { AddressManager } from "@/components/address-manager";
import { getCurrentUser } from "@/lib/auth/session";
import { listAddresses } from "@/lib/services/addresses";

export const metadata: Metadata = {
  title: "Addresses",
  robots: { index: false, follow: false },
};

export default function AddressesPage() {
  return (
    <Suspense fallback={<AddressesSkeleton />}>
      <AddressesContent />
    </Suspense>
  );
}

async function AddressesContent() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const addresses = await listAddresses(user.id);

  return (
    <div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Checkout details
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Saved addresses
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Addresses are private to your account. The default address is offered
          first at checkout.
        </p>
      </div>

      <div className="mt-8">
        <AddressManager initialAddresses={addresses} />
      </div>
    </div>
  );
}

function AddressesSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-3 w-28 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-3 h-9 w-60 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-56 animate-pulse rounded-2xl bg-surface-subtle" />
        <div className="h-56 animate-pulse rounded-2xl bg-surface-subtle" />
      </div>
    </div>
  );
}
