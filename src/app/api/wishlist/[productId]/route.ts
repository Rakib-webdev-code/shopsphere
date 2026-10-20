import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { removeFromWishlist } from "@/lib/services/wishlist";

type RouteParams = { params: Promise<{ productId: string }> };

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { productId } = await context.params;
    const wishlist = await removeFromWishlist(user.id, productId);
    return jsonResponse({ wishlist });
  });
}
