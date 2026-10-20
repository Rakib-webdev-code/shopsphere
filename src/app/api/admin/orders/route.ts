import type { NextRequest } from "next/server";
import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  listOrdersForAdmin,
  parseAdminOrderQuery,
} from "@/lib/services/orders";

export async function GET(request: NextRequest) {
  return runApi(async () => {
    await requireAdmin();
    const result = await listOrdersForAdmin(
      parseAdminOrderQuery(request.nextUrl.searchParams),
    );
    return jsonResponse(result);
  });
}
