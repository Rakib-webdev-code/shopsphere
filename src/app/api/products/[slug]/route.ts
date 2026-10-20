import { jsonResponse, runApi } from "@/lib/api";
import { notFound } from "@/lib/errors";
import {
  getProductBySlug,
  getRelatedProducts,
} from "@/lib/services/products";
import { listProductReviews } from "@/lib/services/reviews";
import { parseObjectId } from "@/lib/validation";

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: RouteParams) {
  return runApi(async () => {
    const { slug } = await context.params;
    const product = await getProductBySlug(slug);

    if (!product) {
      throw notFound("Product not found.");
    }

    const [related, reviews] = await Promise.all([
      getRelatedProducts(product, 4),
      listProductReviews(parseObjectId(product.id, "Product ID"), undefined, 20),
    ]);

    return jsonResponse(
      {
        product,
        relatedProducts: related,
        reviews,
      },
      { cache: "public" },
    );
  });
}
