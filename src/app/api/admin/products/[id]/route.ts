import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import {
  getProductById,
  setProductActive,
  updateProduct,
} from "@/lib/services/products";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const product = await getProductById(id, { includeInactive: true });

    if (!product) {
      throw notFound("Product not found.");
    }

    return jsonResponse({ product });
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const product = await updateProduct(id, body);
    return jsonResponse({ product });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const product = await setProductActive(id, false);
    return jsonResponse({ product });
  });
}
