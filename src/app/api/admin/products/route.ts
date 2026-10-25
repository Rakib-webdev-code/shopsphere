import type { NextRequest } from "next/server";
import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { createProduct, listProducts } from "@/lib/services/products";
import { readJsonBody } from "@/lib/validation";

export async function GET(request: NextRequest) {
  return runApi(async () => {
    await requireAdmin();
    const params = request.nextUrl.searchParams;
    const result = await listProducts({
      q: params.get("q"),
      category: params.get("category"),
      minPrice: params.get("minPrice"),
      maxPrice: params.get("maxPrice"),
      sort: params.get("sort"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
      includeInactive: true,
    });

    return jsonResponse(result);
  });
}

export async function POST(request: Request) {
  return runApi(async () => {
    const admin = await requireAdmin();
    const body = await readJsonBody(request);
    const product = await createProduct(body, admin);
    return jsonResponse({ product }, { status: 201 });
  });
}
