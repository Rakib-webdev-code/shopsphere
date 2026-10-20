import type { NextRequest } from "next/server";
import { jsonResponse, runApi } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getCategoryBySlug } from "@/lib/services/categories";
import { listProducts } from "@/lib/services/products";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(request: NextRequest, context: RouteParams) {
  return runApi(async () => {
    const { slug } = await context.params;
    const category = await getCategoryBySlug(slug);

    if (!category) {
      throw notFound("Category not found.");
    }

    const params = request.nextUrl.searchParams;
    const products = await listProducts({
      category: category.slug,
      q: params.get("q"),
      minPrice: params.get("minPrice"),
      maxPrice: params.get("maxPrice"),
      sort: params.get("sort"),
      page: params.get("page"),
      pageSize: params.get("pageSize"),
    });

    return jsonResponse({ category, ...products }, { cache: "public" });
  });
}
