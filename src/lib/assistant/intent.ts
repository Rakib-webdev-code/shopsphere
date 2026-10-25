import type { Product } from "@/lib/types";
import type { AssistantProductMatch } from "@/lib/assistant/types";

export type AssistantIntent = "search" | "compare" | "alternatives" | "gift";

export type AssistantQuery = {
  raw: string;
  intent: AssistantIntent;
  /** Salient words used to search and rank real catalog records. */
  keywords: string[];
  /** Best matching fixed category slug, when the request names one. */
  categoryHint: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  /** Terms split from "compare X and Y" requests. */
  compareTerms: string[];
  wantsAvailable: boolean;
};

const MAX_BUDGET_CENTS = 10_000_000;

/**
 * The store keeps a fixed set of fifteen categories. These aliases help map
 * natural-language shopping words onto the existing slugs; they never create a
 * category or change the database.
 */
const CATEGORY_ALIASES: Record<string, readonly string[]> = {
  audio: ["audio", "headphone", "headphones", "earbud", "earbuds", "speaker", "speakers", "soundbar", "turntable", "microphone", "music"],
  workspace: ["workspace", "desk", "desk setup", "office", "home office", "keyboard", "mouse", "laptop stand", "monitor", "planner"],
  home: ["home", "living room", "living", "cushion", "throw", "vase", "basket", "candle"],
  accessories: ["accessories", "accessory", "bag", "wallet", "belt", "watch", "sunglasses", "scarf", "card holder"],
  outdoor: ["outdoor", "camping", "camp", "hiking", "trail", "travel", "backpack", "daypack", "trekking", "lantern"],
  wellness: ["wellness", "self care", "self-care", "bath", "sleep", "diffuser", "body care", "skin care"],
  electronics: ["electronics", "charger", "charging", "smart plug", "projector", "photo display", "gadget", "tech"],
  fashion: ["fashion", "clothing", "clothes", "shirt", "dress", "jacket", "trousers", "tee", "apparel"],
  footwear: ["footwear", "shoes", "shoe", "sneaker", "sneakers", "boots", "sandals", "slip ons"],
  "kitchen-dining": ["kitchen", "dining", "cook", "cooking", "mug", "kettle", "skillet", "serving board", "dinner set", "utensil", "pantry"],
  "beauty-personal-care": ["beauty", "personal care", "skincare", "cleanser", "facial oil", "mask", "brush", "body wash"],
  "sports-fitness": ["sports", "fitness", "gym", "workout", "yoga", "exercise", "resistance band", "dumbbell", "jump rope"],
  "books-stationery": ["book", "books", "stationery", "journal", "notebook", "pen", "planner", "puzzle", "chess", "cards"],
  "toys-games": ["toy", "toys", "game", "games", "puzzle", "robot kit", "block set", "plush", "chess"],
  "grocery-essentials": ["grocery", "food", "coffee", "tea", "olive oil", "honey", "salt", "chocolate", "pantry"],
};

const STOP_WORDS = new Set([
  "a", "about", "all", "am", "an", "and", "any", "are", "as", "at", "be",
  "best", "budget", "buy", "can", "compare", "comparison", "could", "do",
  "find", "for", "from", "get", "gift", "good", "have", "help", "i", "in",
  "is", "it", "item", "items", "looking", "me", "my", "need", "of", "on",
  "only", "or", "our", "please", "present", "product", "products", "recommend",
  "show", "similar", "something", "sold", "stock", "suggest", "than", "that",
  "the", "these", "this", "to", "under", "unavailable", "up", "us", "versus",
  "vs", "want", "we", "with", "would", "you", "your", "available", "cheaper",
  "cheapest", "alternative", "alternatives",
]);

const SYNONYMS: Record<string, readonly string[]> = {
  headphone: ["headphones", "audio", "earbuds"],
  headphones: ["headphone", "audio", "earbuds"],
  earbud: ["earbuds", "headphones", "audio"],
  earbuds: ["earbud", "headphones", "audio"],
  speaker: ["speakers", "audio", "sound"],
  speakers: ["speaker", "audio", "sound"],
  shoe: ["shoes", "sneakers", "footwear"],
  shoes: ["shoe", "sneakers", "footwear"],
  sneaker: ["sneakers", "shoes", "footwear"],
  sneakers: ["sneaker", "shoes", "footwear"],
  bag: ["backpack", "pouch", "weekender"],
  desk: ["workspace", "office", "keyboard", "mouse", "lamp"],
  student: ["journal", "pen", "lamp", "backpack", "speaker"],
  travel: ["outdoor", "bag", "bottle", "pouch"],
  coffee: ["mug", "kettle", "beans", "pour over"],
};

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9$.,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(value: string): number | null {
  const amount = Number.parseFloat(value.replaceAll(",", ""));

  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  const cents = Math.round(amount * 100);

  if (!Number.isSafeInteger(cents) || cents > MAX_BUDGET_CENTS) {
    return null;
  }

  return cents;
}

export function parseBudget(text: string): {
  minPriceCents: number | null;
  maxPriceCents: number | null;
} {
  const normalized = normalize(text);
  let minPriceCents: number | null = null;
  let maxPriceCents: number | null = null;

  const between = normalized.match(
    /between\s+\$?([\d,]+(?:\.\d{1,2})?)\s+(?:and|to)\s+\$?([\d,]+(?:\.\d{1,2})?)/,
  );

  if (between) {
    const first = parseAmount(between[1]);
    const second = parseAmount(between[2]);

    if (first !== null && second !== null) {
      minPriceCents = Math.min(first, second);
      maxPriceCents = Math.max(first, second);
    }
  }

  if (maxPriceCents === null) {
    const under = normalized.match(
      /(?:under|below|less than|up to|max(?:imum)?(?: of)?|within|budget(?: of)?|at most)\s+\$?([\d,]+(?:\.\d{1,2})?)/,
    );

    if (under) {
      maxPriceCents = parseAmount(under[1]);
    }
  }

  if (minPriceCents === null) {
    const over = normalized.match(
      /(?:over|above|more than|at least|starting at|from)\s+\$?([\d,]+(?:\.\d{1,2})?)/,
    );

    if (over) {
      minPriceCents = parseAmount(over[1]);
    }
  }

  // A bare dollar amount ("a $50 gift") is most useful as a maximum budget.
  if (minPriceCents === null && maxPriceCents === null) {
    const bare = normalized.match(/\$\s?([\d,]+(?:\.\d{1,2})?)/);

    if (bare) {
      maxPriceCents = parseAmount(bare[1]);
    }
  }

  if (
    minPriceCents !== null &&
    maxPriceCents !== null &&
    minPriceCents > maxPriceCents
  ) {
    [minPriceCents, maxPriceCents] = [maxPriceCents, minPriceCents];
  }

  return { minPriceCents, maxPriceCents };
}

function detectIntent(normalized: string): AssistantIntent {
  if (
    /\b(alternative|alternatives|similar|instead of|replace|sold out|unavailable|out of stock)\b/.test(
      normalized,
    )
  ) {
    return "alternatives";
  }

  if (/\b(compare|comparison|versus|vs)\b/.test(normalized)) {
    return "compare";
  }

  if (/\b(gift|presents?|birthday|anniversary|for a student|for my student)\b/.test(normalized)) {
    return "gift";
  }

  return "search";
}

function detectCategory(normalized: string): string | null {
  let best: { slug: string; length: number } | null = null;

  for (const [slug, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliases) {
      const pattern = new RegExp(
        `(?:^|\\s)${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)`,
      );

      if (pattern.test(normalized)) {
        if (!best || alias.length > best.length) {
          best = { slug, length: alias.length };
        }
      }
    }
  }

  return best?.slug ?? null;
}

export function extractKeywords(normalized: string): string[] {
  const tokens = normalized
    .replace(/\$?\d[\d,.]*/g, " ")
    .split(/[\s-]+/)
    .map((token) => token.replace(/[.,]/g, ""))
    .filter((token) => token.length >= 2)
    .filter((token) => !STOP_WORDS.has(token))
    .filter((token) => !/^(under|over|between|and|to)$/.test(token));

  const expanded = new Set<string>();

  for (const token of tokens) {
    expanded.add(token);

    for (const synonym of SYNONYMS[token] ?? []) {
      expanded.add(synonym);
    }
  }

  return [...expanded].slice(0, 10);
}

function compareTerms(normalized: string): string[] {
  if (!/\b(compare|comparison|versus|vs)\b/.test(normalized)) {
    return [];
  }

  const cleaned = normalized
    .replace(/\b(compare|comparison|versus|vs)\b/g, " ")
    .replace(/\b(please|for me|the|these|those|two|products?)\b/g, " ")
    .trim();
  const parts = cleaned
    .split(/\s+(?:and|with|against|or)\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);

  return parts.slice(0, 2);
}

export function parseAssistantQuery(raw: string): AssistantQuery {
  const normalized = normalize(raw);
  const budget = parseBudget(normalized);

  return {
    raw,
    intent: detectIntent(normalized),
    keywords: extractKeywords(normalized),
    categoryHint: detectCategory(normalized),
    minPriceCents: budget.minPriceCents,
    maxPriceCents: budget.maxPriceCents,
    compareTerms: compareTerms(normalized),
    wantsAvailable: /\b(available|in stock|ready to ship|can buy)\b/.test(normalized),
  };
}

function normalizedText(product: Product): string {
  return [
    product.name,
    product.summary,
    product.description,
    product.tags.join(" "),
    product.highlights.join(" "),
    product.category?.name ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function scoreProduct(product: Product, query: AssistantQuery): number {
  const text = normalizedText(product);
  let score = 0;

  for (const keyword of query.keywords) {
    if (product.name.toLowerCase().includes(keyword)) {
      score += 8;
    }

    if (product.tags.some((tag) => tag.toLowerCase().includes(keyword))) {
      score += 5;
    }

    if (text.includes(keyword)) {
      score += 2;
    }
  }

  if (query.categoryHint && product.category?.slug === query.categoryHint) {
    score += 5;
  }

  if (product.inStock) {
    score += 3;
  } else if (query.wantsAvailable) {
    score -= 20;
  }

  if (product.featured) {
    score += 1.5;
  }

  score += Math.min(product.rating, 5) * 0.8;

  if (query.intent === "gift") {
    score += product.inStock ? 2 : 0;
    score += Math.min(product.rating, 5) * 0.6;
  }

  if (
    query.maxPriceCents !== null &&
    product.priceInCents <= query.maxPriceCents
  ) {
    // Slightly prefer items that use more of the stated budget, while keeping
    // relevance as the dominant signal.
    const ratio =
      query.maxPriceCents === 0
        ? 0
        : product.priceInCents / query.maxPriceCents;
    score += Math.min(ratio, 1) * 1.5;
  }

  return score;
}

function keywordVariants(keyword: string): string[] {
  if (keyword.length > 3 && keyword.endsWith("s") && !keyword.endsWith("ss")) {
    return [keyword, keyword.slice(0, -1)];
  }

  return [keyword];
}

/**
 * A product is relevant when at least one parsed keyword appears in its name,
 * tags, or searchable text. Availability words are removed during parsing, so
 * "only show products in stock" stays a broad availability request instead of
 * searching for the literal word "stock".
 */
function hasKeywordMatch(product: Product, query: AssistantQuery): boolean {
  if (query.keywords.length === 0) {
    return true;
  }

  const name = product.name.toLowerCase();
  const text = normalizedText(product);

  return query.keywords.some((keyword) =>
    keywordVariants(keyword).some(
      (variant) =>
        name.includes(variant) ||
        product.tags.some((tag) => tag.toLowerCase().includes(variant)) ||
        text.includes(variant),
    ),
  );
}

export function rankProducts(
  products: readonly Product[],
  query: AssistantQuery,
): Product[] {
  // Only plain searches require a keyword hit. Gift, comparison, and
  // alternatives requests intentionally fall back to category or budget
  // matches when the exact words are not present in the catalog.
  const requiresKeywordMatch =
    query.intent === "search" && query.keywords.length > 0;

  return [...products]
    .filter((product) => product.active)
    .filter(
      (product) => !requiresKeywordMatch || hasKeywordMatch(product, query),
    )
    .filter((product) => {
      if (
        query.minPriceCents !== null &&
        product.priceInCents < query.minPriceCents
      ) {
        return false;
      }

      if (
        query.maxPriceCents !== null &&
        product.priceInCents > query.maxPriceCents
      ) {
        return false;
      }

      return true;
    })
    .sort((first, second) => {
      const score = scoreProduct(second, query) - scoreProduct(first, query);

      if (score !== 0) {
        return score;
      }

      return first.name.localeCompare(second.name);
    });
}

export function describeMatch(product: Product, query: AssistantQuery): string {
  const details: string[] = [];

  if (product.inStock) {
    details.push("in stock");
  } else {
    details.push("currently out of stock");
  }

  if (query.categoryHint && product.category?.slug === query.categoryHint) {
    details.push(`in ${product.category.name}`);
  } else if (product.category) {
    details.push(`from ${product.category.name}`);
  }

  if (query.maxPriceCents !== null) {
    details.push("within your stated budget");
  }

  if (product.rating > 0) {
    details.push(`rated ${product.rating.toFixed(1)}/5`);
  }

  return `Matched from the live catalog: ${details.join(", ")}.`;
}

function budgetLabel(query: AssistantQuery): string | null {
  if (query.minPriceCents === null && query.maxPriceCents === null) {
    return null;
  }

  const money = (cents: number) =>
    `$${(cents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  if (query.minPriceCents !== null && query.maxPriceCents !== null) {
    return `${money(query.minPriceCents)}–${money(query.maxPriceCents)}`;
  }

  if (query.maxPriceCents !== null) {
    return `up to ${money(query.maxPriceCents)}`;
  }

  return `from ${money(query.minPriceCents as number)}`;
}

export function toMatches(
  products: readonly Product[],
  query: AssistantQuery,
): AssistantProductMatch[] {
  return products.map((product) => ({
    product,
    reason: describeMatch(product, query),
  }));
}

/**
 * Applies provider ranking hints while retaining only server-authored match
 * explanations and product records. Provider text is untrusted and must never
 * be shown as a product fact or recommendation rationale.
 */
export function reorderMatchesByAiSelections(
  matches: readonly AssistantProductMatch[],
  selections: readonly AiSelection[],
): AssistantProductMatch[] {
  const matchesById = new Map(
    matches.map((match) => [match.product.id, match]),
  );
  const seen = new Set<string>();
  const ordered: AssistantProductMatch[] = [];

  for (const selection of selections) {
    const match = matchesById.get(selection.id);

    if (match && !seen.has(selection.id)) {
      seen.add(selection.id);
      ordered.push(match);
    }
  }

  return ordered.slice(0, 4);
}

export function buildCatalogReply(
  query: AssistantQuery,
  matches: AssistantProductMatch[],
  options: {
    reference?: Product | null;
    notice?: string;
  } = {},
): {
  message: string;
  products: AssistantProductMatch[];
  followUps: string[];
  notice?: string;
} {
  const budget = budgetLabel(query);
  const reference = options.reference ?? null;

  if (query.intent === "compare") {
    if (matches.length >= 2) {
      return {
        message:
          "Here is a comparison using the current catalog price, stock, rating, and category data. The cards below are the source of truth; I have not estimated any specifications.",
        products: matches.slice(0, 2),
        followUps: [
          "Which one is better for a small desk?",
          "Show me something cheaper instead",
        ],
        notice: options.notice,
      };
    }

    return {
      message:
        matches.length === 1
          ? `I found ${matches[0].product.name}, but I need a second product to compare it with. Try “compare ${matches[0].product.name} and …”.`
          : "I could not find two matching products in the active catalog. Try naming two products or asking for a category.",
      products: matches.slice(0, 1),
      followUps: ["Compare two audio products", "Show me current bestsellers"],
      notice: options.notice,
    };
  }

  if (matches.length === 0) {
    const parts = ["I could not find an active product"];

    if (query.categoryHint) {
      parts.push(`in ${query.categoryHint.replaceAll("-", " ")}`);
    }

    if (budget) {
      parts.push(`within ${budget}`);
    }

    parts.push(
      "in the live ShopSphere catalog. Try widening the budget, removing a filter, or browsing all categories.",
    );

    return {
      message: parts.join(" ").replace("  ", " "),
      products: [],
      followUps: ["Show me products under $50", "Browse the full catalog"],
      notice: options.notice,
    };
  }

  if (query.intent === "alternatives") {
    const categoryText = reference?.category
      ? ` from ${reference.category.name}`
      : query.categoryHint
        ? ` in ${query.categoryHint.replaceAll("-", " ")}`
        : "";

    return {
      message: reference
        ? `${reference.name} is ${
            reference.active && reference.stock > 0
              ? "still listed, but here are close alternatives"
              : "currently unavailable"
          }. These alternatives${categoryText} are real active records; check the current stock shown on each card before ordering.`
        : `Here are active catalog alternatives${categoryText}. Every price and stock count below comes from the database, not from a language model.`,
      products: matches.slice(0, 4),
      followUps: [
        "Compare two audio products",
        "Show only items under $100",
      ],
      notice: options.notice,
    };
  }

  if (query.intent === "gift") {
    return {
      message: `Here are thoughtful options${budget ? ` ${budget}` : ""} from the live catalog. I prioritised in-stock items with stronger ratings; the cards show the verified price and availability.`,
      products: matches.slice(0, 4),
      followUps: [
        "Make it cheaper",
        "Show gifts for someone who likes cooking",
      ],
      notice: options.notice,
    };
  }

  return {
    message: `I found ${matches.length} matching ${
      matches.length === 1 ? "product" : "products"
    }${budget ? ` ${budget}` : ""}. The results are ranked from active catalog records, and every price, rating, and stock count comes from the database.`,
    products: matches.slice(0, 4),
    followUps: [
      "Compare two audio products",
      "Show me something cheaper",
      "Only show products in stock",
    ],
    notice: options.notice,
  };
}

export type AiSelection = {
  id: string;
  reason: string;
};

/**
 * Validates provider output before it can influence the response.
 *
 * The model may only return IDs that exist in the candidate set and short
 * reasons. Price, stock, URL, and name fields are never accepted from the
 * model; the server hydrates them from the database.
 */
export function validateAiSelections(
  raw: unknown,
  allowedIds: readonly string[],
): AiSelection[] | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const selections = (raw as { selections?: unknown }).selections;

  if (!Array.isArray(selections)) {
    return null;
  }

  const allowed = new Set(allowedIds);
  const seen = new Set<string>();
  const valid: AiSelection[] = [];

  for (const entry of selections.slice(0, 6)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }

    const id = (entry as { id?: unknown }).id;
    const reason = (entry as { reason?: unknown }).reason;

    if (
      typeof id !== "string" ||
      !allowed.has(id) ||
      seen.has(id) ||
      typeof reason !== "string"
    ) {
      continue;
    }

    const cleaned = reason.replace(/\s+/g, " ").trim();

    if (cleaned.length < 8 || cleaned.length > 220) {
      continue;
    }

    // A provider must not introduce a price or a stock quantity into the
    // explanation. Those values come only from the product document.
    if (/\$\s?\d/.test(cleaned) || /\b\d+\s*(?:left|in stock|available|units)\b/i.test(cleaned)) {
      continue;
    }

    seen.add(id);
    valid.push({ id, reason: cleaned });
  }

  return valid.length > 0 ? valid.slice(0, 4) : null;
}
