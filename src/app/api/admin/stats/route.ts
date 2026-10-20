import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { getAdminStats } from "@/lib/services/admin";

export async function GET() {
  return runApi(async () => {
    await requireAdmin();
    const stats = await getAdminStats();
    return jsonResponse({ stats });
  });
}
