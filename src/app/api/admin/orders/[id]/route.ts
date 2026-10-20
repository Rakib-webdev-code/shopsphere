import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  getOrderForAdmin,
  updateOrderStatus,
} from "@/lib/services/orders";
import { asRecord, readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const order = await getOrderForAdmin(id);
    return jsonResponse({ order });
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = asRecord(await readJsonBody(request));
    const order = await updateOrderStatus(id, body.status);
    return jsonResponse({ order });
  });
}
