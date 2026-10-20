import { jsonResponse, runApi } from "@/lib/api";
import { requireUser } from "@/lib/auth/session";
import {
  getProfileForUser,
  updateProfileForUser,
} from "@/lib/services/profile";
import { readJsonBody } from "@/lib/validation";

export async function GET() {
  return runApi(async () => {
    const user = await requireUser();
    const profile = await getProfileForUser(user.id);
    return jsonResponse({ profile });
  });
}

export async function PATCH(request: Request) {
  return runApi(async () => {
    const user = await requireUser();
    const body = await readJsonBody(request);
    const profile = await updateProfileForUser(user.id, body);
    return jsonResponse({ profile });
  });
}
