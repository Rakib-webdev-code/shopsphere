import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { adjustProductStock } from "@/lib/services/inventory";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteParams) {
  return runApi(async () => {
    const admin = await requireAdmin();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const result = await adjustProductStock(id, admin, body);
    return jsonResponse(result);
  });
}
