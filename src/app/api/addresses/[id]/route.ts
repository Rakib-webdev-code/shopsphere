import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { deleteAddress, updateAddress } from "@/lib/services/addresses";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const address = await updateAddress(user.id, id, body);
    return jsonResponse({ address });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const user = await requireUser();
    const { id } = await context.params;
    await deleteAddress(user.id, id);
    return jsonResponse({ success: true });
  });
}
