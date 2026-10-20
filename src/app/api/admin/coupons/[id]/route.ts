import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import {
  deleteOrDeactivateCoupon,
  getCouponById,
  updateCoupon,
} from "@/lib/services/coupons";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const coupon = await getCouponById(id);

    if (!coupon) {
      throw notFound("Coupon not found.");
    }

    return jsonResponse({ coupon });
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const coupon = await updateCoupon(id, body);
    return jsonResponse({ coupon });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const coupon = await deleteOrDeactivateCoupon(id);
    return jsonResponse({ coupon });
  });
}
