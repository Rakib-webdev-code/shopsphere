import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { listCustomerSummaries } from "@/lib/services/admin";

export async function GET() {
  return runApi(async () => {
    await requireAdmin();
    const customers = await listCustomerSummaries();
    return jsonResponse({ customers });
  });
}
