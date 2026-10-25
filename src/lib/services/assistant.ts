import {
  categoriesCollection,
  productsCollection,
} from "@/lib/db/collections";
import type { CategoryDoc } from "@/lib/db/types";
import { getProductById, listProducts } from "@/lib/services/products";
import type { Product } from "@/lib/types";
import {
  asRecord,
  escapeRegex,
  parseObjectId,
  readOptionalString,
  readString,
} from "@/lib/validation";
import type { AssistantReply } from "@/lib/assistant/types";
import type { AssistantQuery } from "@/lib/assistant/intent";
import {
  buildCatalogReply,
  parseAssistantQuery,
  rankProducts,
  reorderMatchesByAiSelections,
  toMatches,
  validateAiSelections,
  type AiSelection,
} from "@/lib/assistant/intent";

const MAX_CANDIDATES = 12;
const AI_CANDIDATES = 8;
const AI_TIMEOUT_MS = 8_000;

type AiConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

function aiConfig(): AiConfig | null {
  const apiKey = process.env.AI_ASSISTANT_API_KEY?.trim();
  const model = process.env.AI_ASSISTANT_MODEL?.trim();

  if (!apiKey || !model) {
    return null;
  }

  return {
    apiKey,
    model,
    baseUrl: (
      process.env.AI_ASSISTANT_BASE_URL?.trim() ||
      "https://api.openai.com/v1"
    ).replace(/\/+$/, ""),
  };
}

function toPriceInput(cents: number | null): string | undefined {
  return cents === null ? undefined : (cents / 100).toFixed(2);
}

function dedupeProducts(products: readonly Product[]): Product[] {
  const map = new Map<string, Product>();

  for (const product of products) {
    if (!map.has(product.id)) {
      map.set(product.id, product);
    }
  }

  return [...map.values()];
}

async function resolveCategory(query: AssistantQuery): Promise<CategoryDoc | null> {
  if (!query.categoryHint) {
    return null;
  }

  return categoriesCollection.findOne({
    slug: query.categoryHint,
    active: true,
  });
}

async function catalogSearch(
  query: AssistantQuery,
  category: CategoryDoc | null,
): Promise<Product[]> {
  const priceFilters = {
    minPrice: toPriceInput(query.minPriceCents),
    maxPrice: toPriceInput(query.maxPriceCents),
  };
  const categorySlug = category?.slug ?? null;
  const useKeywordSearch =
    query.intent !== "gift" && query.intent !== "alternatives";

  const keywordTerms = useKeywordSearch ? query.keywords.slice(0, 3) : [];
  const requests: Promise<{ products: Product[] }>[] = [];

  // Broad category/budget query: this is the safe fallback when the inferred
  // category or a keyword is too narrow.
  requests.push(
    listProducts({
      category: categorySlug,
      ...priceFilters,
      sort: "featured",
      pageSize: "24",
    }),
  );

  for (const term of keywordTerms) {
    requests.push(
      listProducts({
        q: term,
        category: categorySlug,
        ...priceFilters,
        sort: "featured",
        pageSize: "12",
      }),
    );
  }

  // If a category was inferred, allow keyword matches from other categories
  // when the category-specific query is sparse. This avoids confidently
  // returning nothing because of a bad synonym guess.
  if (categorySlug && keywordTerms[0]) {
    requests.push(
      listProducts({
        q: keywordTerms[0],
        ...priceFilters,
        sort: "featured",
        pageSize: "12",
      }),
    );
  }

  const results = await Promise.all(requests);
  let products = dedupeProducts(results.flatMap((result) => result.products));

  if (products.length < 2) {
    // Last bounded fallback: a wider active-catalog page. It is ranked
    // locally, so the assistant still respects the stated budget and
    // availability constraints.
    const fallback = await listProducts({
      category: categorySlug,
      ...priceFilters,
      sort: "newest",
      pageSize: "24",
    });
    products = dedupeProducts([...products, ...fallback.products]);
  }

  return rankProducts(products, query).slice(0, MAX_CANDIDATES);
}

async function findProductByText(term: string): Promise<Product | null> {
  const cleaned = term.trim();

  if (!cleaned) {
    return null;
  }

  // Search the real collection read-only so an unavailable reference product
  // can still be identified for an "alternatives" request.
  const regex = new RegExp(escapeRegex(cleaned), "i");
  const products = await productsCollection
    .find({
      $or: [{ name: regex }, { slug: regex }, { tags: regex }, { summary: regex }],
    })
    .sort({ active: -1, stock: -1 })
    .limit(5)
    .toArray();

  if (products.length === 0) {
    return null;
  }

  const chosen = products[0];
  const category = await categoriesCollection.findOne({
    _id: chosen.categoryId,
  });

  return {
    id: chosen._id.toHexString(),
    slug: chosen.slug,
    name: chosen.name,
    sku: chosen.sku,
    summary: chosen.summary,
    description: chosen.description,
    highlights: chosen.highlights ?? [],
    tags: chosen.tags ?? [],
    priceInCents: chosen.priceInCents,
    compareAtPriceInCents: chosen.compareAtPriceInCents ?? null,
    category: category
      ? {
          id: category._id.toHexString(),
          name: category.name,
          slug: category.slug,
          icon: category.icon,
        }
      : null,
    images: chosen.images ?? [],
    stock: chosen.stock,
    inStock: chosen.stock > 0,
    badge: chosen.badge ?? null,
    featured: Boolean(chosen.featured),
    active: Boolean(chosen.active),
    rating: Math.round((chosen.ratingAverage ?? 0) * 10) / 10,
    reviewCount: chosen.ratingCount ?? 0,
    createdAt: chosen.createdAt.toISOString(),
    updatedAt: chosen.updatedAt.toISOString(),
  };
}

async function resolveReferenceProduct(
  query: AssistantQuery,
  referenceProductId: string | null,
): Promise<Product | null> {
  if (referenceProductId) {
    return getProductById(referenceProductId, { includeInactive: true });
  }

  const terms = query.compareTerms.length
    ? query.compareTerms
    : query.keywords.slice(0, 2);

  for (const term of terms) {
    const product = await findProductByText(term);

    if (product) {
      return product;
    }
  }

  return null;
}

async function compareProducts(
  query: AssistantQuery,
): Promise<Product[]> {
  const found: Product[] = [];

  for (const term of query.compareTerms.slice(0, 2)) {
    const product = await findProductByText(term);

    if (
      product &&
      product.active &&
      !found.some((entry) => entry.id === product.id)
    ) {
      found.push(product);
    }
  }

  if (found.length >= 2) {
    return found.slice(0, 2);
  }

  // If only one side was named, fall back to the top ranked alternatives from
  // the same category/budget so the shopper still gets a useful comparison.
  const category = await resolveCategory(query);
  const candidates = await catalogSearch(query, category);
  const merged = dedupeProducts([...found, ...candidates]);

  return rankProducts(merged, query).slice(0, 2);
}

async function searchProducts(
  query: AssistantQuery,
  category: CategoryDoc | null,
  excludeId: string | null,
): Promise<Product[]> {
  const candidates = await catalogSearch(query, category);

  return candidates
    .filter((product) => product.id !== excludeId)
    .filter((product) => (query.wantsAvailable ? product.inStock : true));
}

async function applyAiReasons(
  config: AiConfig,
  query: AssistantQuery,
  products: Product[],
): Promise<AiSelection[] | null> {
  const candidates = products.slice(0, AI_CANDIDATES);

  if (candidates.length === 0) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "You rank products for ShopSphere. You may only choose IDs from the supplied candidate list. Never invent products, prices, stock counts, URLs, or specifications. Never write a dollar amount or stock quantity. Return strict JSON only: {\"selections\":[{\"id\":\"...\",\"reason\":\"short reason grounded only in the supplied fields\"}]}. Choose at most four IDs.",
          },
          {
            role: "user",
            content: JSON.stringify({
              request: query.raw,
              intent: query.intent,
              maxPriceCents: query.maxPriceCents,
              candidates: candidates.map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category?.name ?? null,
                priceInCents: product.priceInCents,
                stock: product.stock,
                rating: product.rating,
                tags: product.tags,
                highlights: product.highlights,
                summary: product.summary,
              })),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Provider returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      throw new Error("Provider returned no text content.");
    }

    let parsed: unknown;
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Provider returned malformed JSON.");
    }

    const selections = validateAiSelections(
      parsed,
      candidates.map((product) => product.id),
    );

    if (!selections) {
      throw new Error("Provider returned no valid catalog selections.");
    }

    return selections;
  } finally {
    clearTimeout(timeout);
  }
}

async function buildReply(
  query: AssistantQuery,
  referenceProductId: string | null,
): Promise<AssistantReply> {
  const category = await resolveCategory(query);
  const config = aiConfig();
  let reference: Product | null = null;
  let products: Product[] = [];

  if (query.intent === "compare") {
    products = await compareProducts(query);
  } else if (query.intent === "alternatives") {
    reference = await resolveReferenceProduct(query, referenceProductId);
    const effectiveCategory = reference?.category
      ? await categoriesCollection.findOne({
          _id: parseObjectId(reference.category.id, "Category ID"),
          active: true,
        })
      : category;
    products = await searchProducts(query, effectiveCategory, reference?.id ?? null);
  } else {
    products = await searchProducts(query, category, null);
    reference =
      referenceProductId !== null
        ? await getProductById(referenceProductId, { includeInactive: true })
        : null;
  }

  const matches = toMatches(products, query);

  if (config && products.length > 0) {
    try {
      const aiReasons = await applyAiReasons(config, query, products);

      if (aiReasons && aiReasons.length > 0) {
        const ordered = reorderMatchesByAiSelections(
          matches,
          aiReasons,
        );

        if (ordered.length > 0) {
          const reply = buildCatalogReply(query, ordered, { reference });
          return { ...reply, mode: "ai" };
        }
      }
    } catch (error) {
      console.warn(
        "[assistant] Configured AI provider was unavailable; using verified catalog results:",
        error instanceof Error ? error.message : "unknown provider error",
      );
    }
  }

  const reply = buildCatalogReply(query, matches, {
    reference,
    notice:
      config && products.length > 0
        ? "Live AI ranking is temporarily unavailable. These are verified catalog matches."
        : undefined,
  });

  return { ...reply, mode: "catalog" };
}

/**
 * Answers a shopper request from read-only catalog data.
 *
 * The function never writes to MongoDB, never accepts a client-supplied price
 * or product object, and treats provider output as untrusted ranking hints.
 */
export async function answerShoppingQuestion(raw: unknown): Promise<AssistantReply> {
  const body = asRecord(raw);
  const message = readString(body.message, {
    label: "Message",
    min: 2,
    max: 500,
  });
  const referenceValue = readOptionalString(body.productId, {
    label: "Reference product",
    max: 40,
  });
  let referenceProductId: string | null = null;

  if (referenceValue) {
    const parsed = parseObjectId(referenceValue, "Reference product");
    referenceProductId = parsed.toHexString();
  }

  const query = parseAssistantQuery(message);

  if (query.compareTerms.length === 1 && query.intent === "compare") {
    // "Compare these two" has no product names. Let catalog ranking choose the
    // two closest matches instead of inventing product references.
    query.compareTerms = [];
  }

  return buildReply(query, referenceProductId);
}

