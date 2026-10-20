import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { deleteReview, updateReview } from "@/lib/services/reviews";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const review = await updateReview(user, id, body);
    return jsonResponse({ review });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteReview(user, id);
    return jsonResponse({ success: true });
  });
}
