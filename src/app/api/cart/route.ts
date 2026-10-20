import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { getCartForUser } from "@/lib/services/cart";

export async function GET() {
  return runApi(async () => {
    const user = await requireUser();
    const cart = await getCartForUser(user.id);
    return jsonResponse({ cart });
  });
}
