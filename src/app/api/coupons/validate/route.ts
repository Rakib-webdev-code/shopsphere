import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { ValidationError } from "@/lib/errors";
import { readCheckoutPreview } from "@/lib/services/orders";
import { asRecord, readJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = asRecord(await readJsonBody(request));

    if (typeof body.code !== "string" || !body.code.trim()) {
      throw new ValidationError("Coupon code is required.");
    }

    const preview = await readCheckoutPreview(user.id, body.code);
    return jsonResponse({ preview });
  });
}
