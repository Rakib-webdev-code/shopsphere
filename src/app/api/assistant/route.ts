import { jsonResponse, runApi } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth/session";
import { assistantRateLimiter } from "@/lib/rate-limit";
import { answerShoppingQuestion } from "@/lib/services/assistant";
import { readJsonBody } from "@/lib/validation";

function requestKey(request: Request, userId: string | null) {
  if (userId) {
    return `user:${userId}`;
  }

  // These headers are set by the deployment proxy. For anonymous traffic they
  // are a best-effort abuse control, not an authentication signal.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address =
    forwarded ||
    request.headers.get("x-real-ip")?.trim() ||
    "anonymous";

  return `ip:${address.slice(0, 80)}`;
}

export async function POST(request: Request) {
  return runApi(async () => {
    const body = await readJsonBody(request, 8_000);
    const user = await getCurrentUser();
    const limit = assistantRateLimiter.check(requestKey(request, user?.id ?? null));

    if (!limit.allowed) {
      return jsonResponse(
        {
          error: {
            code: "RATE_LIMITED",
            message:
              "You have asked several questions in a short time. Please wait a moment and try again.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(limit.retryAfterMs / 1_000))),
          },
        },
      );
    }

    const reply = await answerShoppingQuestion(body);
    return jsonResponse(reply);
  });
}
