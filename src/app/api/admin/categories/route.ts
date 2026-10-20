import { jsonResponse, runApi } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/session";
import {
  createCategory,
  listCategories,
} from "@/lib/services/categories";
import { readJsonBody } from "@/lib/validation";

export async function GET() {
  return runApi(async () => {
    await requireAdmin();
    const categories = await listCategories({ includeInactive: true });
    return jsonResponse({ categories });
  });
}

export async function POST(request: Request) {
  return runApi(async () => {
    await requireAdmin();
    const body = await readJsonBody(request);
    const category = await createCategory(body);
    return jsonResponse({ category }, { status: 201 });
  });
}
