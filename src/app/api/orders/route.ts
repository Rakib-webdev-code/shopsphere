import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { listOrdersForUser } from "@/lib/services/orders";

export async function GET() {
  return runApi(async () => {
    const user = await requireUser();
    const orders = await listOrdersForUser(user.id);
    return jsonResponse({ orders });
  });
}
