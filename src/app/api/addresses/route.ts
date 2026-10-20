import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import { createAddress, listAddresses } from "@/lib/services/addresses";
import { readJsonBody } from "@/lib/validation";

export async function GET() {
  return runApi(async () => {
    const user = await requireUser();
    const addresses = await listAddresses(user.id);
    return jsonResponse({ addresses });
  });
}

export async function POST(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const address = await createAddress(user.id, body);
    return jsonResponse({ address }, { status: 201 });
  });
}
