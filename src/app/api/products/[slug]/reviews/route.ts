import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createReview } from "@/lib/services/reviews";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { slug } = await context.params;
    const body = await readJsonBody(request);
    const review = await createReview(user, slug, body);

    return jsonResponse({ review }, { status: 201 });
  });
}
