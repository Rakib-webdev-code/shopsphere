import type { NextRequest } from "next/server";
import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { ordersCollection } from "@/lib/db/collections";
import { recoverPendingInventoryReleases } from "@/lib/services/orders";

export async function GET() {
  return runApi(async () => {
    await requireAdmin();
    const [releasingCount, reservingCount, reconciliationCount] =
      await Promise.all([
        ordersCollection.countDocuments({ inventoryState: "releasing" }),
        ordersCollection.countDocuments({ inventoryState: "reserving" }),
        ordersCollection.countDocuments({ reconciliationRequired: true }),
      ]);

    return jsonResponse({
      releasingCount,
      reservingCount,
      reconciliationCount,
    });
  });
}

export async function POST(request: NextRequest) {
  return runApi(async () => {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const limit = Number(searchParams.get("limit") ?? "25");
    const result = await recoverPendingInventoryReleases(limit);
    return jsonResponse(result);
  });
}
