import type { NextRequest } from "next/server";
import { jsonResponse, runApi } from "@/lib/api";
import { listProducts } from "@/lib/services/products";

export async function GET(request: NextRequest) {
  return runApi(async () => {
    const params = request.nextUrl.searchParams;
    const result = await listProducts({
      q: params.get("q"),
      category: params.get("category"),
      minPrice: params.get("minPrice"),
      maxPrice: params.get("maxPrice"),
      sort: params.get("sort"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });

    return jsonResponse(result, { cache: "public" });
  });
}
