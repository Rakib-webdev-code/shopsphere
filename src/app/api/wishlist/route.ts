import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { addToWishlist, getWishlistForUser } from "@/lib/services/wishlist";
import { readJsonBody } from "@/lib/validation";

export async function GET() {
  return runApi(async () => {
    const user = await requireUser();
    const wishlist = await getWishlistForUser(user.id);
    return jsonResponse({ wishlist });
  });
}

export async function POST(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const wishlist = await addToWishlist(user.id, body);
    return jsonResponse({ wishlist }, { status: 201 });
  });
}
