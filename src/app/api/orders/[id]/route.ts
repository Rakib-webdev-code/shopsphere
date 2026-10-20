import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getOrderForUser } from "@/lib/services/orders";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const order = await getOrderForUser(user.id, id);
    return jsonResponse({ order });
  });
}
