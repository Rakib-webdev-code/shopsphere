import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createOrder } from "@/lib/services/orders";
import { readJsonBody } from "@/lib/validation";

export async function POST(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const order = await createOrder(user, body);
    return jsonResponse({ order }, { status: 201 });
  });
}
