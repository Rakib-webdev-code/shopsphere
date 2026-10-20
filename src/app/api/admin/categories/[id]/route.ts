import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import { notFound } from "@/lib/errors";
import {
  deleteOrDeactivateCategory,
  getCategoryById,
  updateCategory,
} from "@/lib/services/categories";
import { readJsonBody } from "@/lib/validation";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const category = await getCategoryById(id, { includeInactive: true });

    if (!category) {
      throw notFound("Category not found.");
    }

    return jsonResponse({ category });
  });
}

export async function PATCH(request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const body = await readJsonBody(request);
    const category = await updateCategory(id, body);
    return jsonResponse({ category });
  });
}

export async function DELETE(_request: Request, context: RouteParams) {
  return runApi(async () => {
    await requireAdmin();
    const { id } = await context.params;
    const category = await deleteOrDeactivateCategory(id);
    return jsonResponse({ category });
  });
}
