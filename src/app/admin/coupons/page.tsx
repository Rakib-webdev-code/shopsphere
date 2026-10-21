import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminCouponManager } from "@/components/admin-coupon-manager";
import { Alert } from "@/components/ui";
import { requireAdminPage } from "@/lib/auth/session";
import { listCoupons } from "@/lib/services/coupons";

export const metadata: Metadata = { title: "Coupons" };

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<CouponsSkeleton />}>
      <CouponsContent />
    </Suspense>
  );
}

async function CouponsContent() {
  await connection();
  await requireAdminPage();
  let coupons;

  try {
    coupons = await listCoupons();
  } catch {
    return <Alert tone="error">Coupons could not be loaded.</Alert>;
  }

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Coupons
        </h2>
        <p className="mt-1.5 max-w-3xl text-sm text-muted">
          Coupons are validated again during checkout. Usage is reserved with a
          conditional update, so a limited coupon cannot be oversubscribed.
        </p>
      </div>

      <div className="mt-6">
        <AdminCouponManager coupons={coupons} />
      </div>
    </div>
  );
}

function CouponsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="h-8 w-32 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-12 w-36 animate-pulse rounded-full bg-surface-subtle" />
      <div className="mt-6 h-96 animate-pulse rounded-2xl bg-surface-subtle" />
    </div>
  );
}
