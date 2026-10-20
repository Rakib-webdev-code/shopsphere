import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { removeCartItem, updateCartItem } from "@/lib/services/cart";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ productId: string }> };

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { productId } = await context.params;
    const body = await readJsonBody(request);
    const cart = await updateCartItem(user.id, productId, body);
    return jsonResponse({ cart });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { productId } = await context.params;
    const cart = await removeCartItem(user.id, productId);
    return jsonResponse({ cart });
  });
}
