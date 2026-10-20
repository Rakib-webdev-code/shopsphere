import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { createCoupon, listCoupons } from "@/lib/services/coupons";
import { readJsonBody } from "@/lib/validation";

export async function GET() {
  return runApi(async () => {
    await requireAdmin();
    const coupons = await listCoupons();
    return jsonResponse({ coupons });
  });
}

export async function POST(request: Request) {
  return runApi(async () => {
    await requireAdmin();
    const body = await readJsonBody(request);
    const coupon = await createCoupon(body);
    return jsonResponse({ coupon }, { status: 201 });
  });
}
