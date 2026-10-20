import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addCartItem } from "@/lib/services/cart";
import { readJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const cart = await addCartItem(user.id, body);
    return jsonResponse({ cart }, { status: 201 });
  });
}
