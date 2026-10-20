import { jsonResponse, runApi } from "@/lib/api";
import { listCategories } from "@/lib/services/categories";

export async function GET() {
  return runApi(async () => {
    const categories = await listCategories();
    return jsonResponse({ categories }, { cache: "public" });
  });
}
