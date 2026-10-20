import { ObjectId, type Filter, type Sort } from "mongodb";
import {
  categoriesCollection,
  productsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type { CategoryDoc, ProductDoc } from "@/lib/db/types";
import { conflict, notFound, ValidationError } from "@/lib/errors";
import { PRODUCTS_PER_PAGE } from "@/lib/constants";
import type {
  Product,
  ProductBadge,
  ProductFilters,
  ProductListResult,
} from "@/lib/types";
import {
  asRecord,
  escapeRegex,
  normalizeSlug,
  parseMoneyToCents,
  parseObjectId,
  parsePage,
  parsePageSize,
  parseSort,
  readBoolean,
  readEnum,
  readInt,
  readOptionalPriceCents,
  readPriceCents,
  readString,
  readStringArray,
  validateImageUrls,
} from "@/lib/validation";

export type ProductQueryInput = {
  q?: string | null;
  category?: string | null;
  minPrice?: string | null;
  maxPrice?: string | null;
  sort?: string | null;
  page?: string | null;
  pageSize?: string | null;
  featured?: boolean;
  includeInactive?: boolean;
};

function categoryRef(category: CategoryDoc | null | undefined) {
  if (!category) {
    return null;
  }

  return {
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
    icon: category.icon,
  };
}

export function serializeProduct(
  product: ProductDoc,
  category: CategoryDoc | null | undefined,
): Product {
  return {
    id: product._id.toHexString(),
    slug: product.slug,
    name: product.name,
    sku: product.sku,
    summary: product.summary,
    description: product.description,
    highlights: product.highlights ?? [],
    tags: product.tags ?? [],
    priceInCents: product.priceInCents,
    compareAtPriceInCents: product.compareAtPriceInCents ?? null,
    category: categoryRef(category),
    images: product.images ?? [],
    stock: product.stock,
    inStock: product.stock > 0,
    badge: product.badge ?? null,
    featured: Boolean(product.featured),
    active: Boolean(product.active),
    rating: Math.round((product.ratingAverage ?? 0) * 10) / 10,
    reviewCount: product.ratingCount ?? 0,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}

export async function serializeProducts(
  documents: ProductDoc[],
): Promise<Product[]> {
  const categories = await getCategoriesById(
    documents.map((product) => product.categoryId),
  );

  return documents.map((product) =>
    serializeProduct(
      product,
      categories.get(product.categoryId.toHexString()) ?? null,
    ),
  );
}

async function getCategoriesById(ids: ProductDoc["categoryId"][]) {
  if (ids.length === 0) {
    return new Map<string, CategoryDoc>();
  }

  const uniqueIds = [...new Map(ids.map((id) => [id.toHexString(), id])).values()];
  const categories = await categoriesCollection
    .find({ _id: { $in: uniqueIds } })
    .toArray();

  return new Map(categories.map((category) => [category._id.toHexString(), category]));
}

export function normalizeProductFilters(input: ProductQueryInput): ProductFilters {
  const query = (input.q ?? "").trim();

  if (query.length > 100) {
    throw new ValidationError("Search text must be 100 characters or fewer.");
  }

  const category = (input.category ?? "").trim();
  const minPriceCents = parseMoneyToCents(input.minPrice, "Minimum price");
  const maxPriceCents = parseMoneyToCents(input.maxPrice, "Maximum price");

  if (
    minPriceCents !== null &&
    maxPriceCents !== null &&
    minPriceCents > maxPriceCents
  ) {
    throw new ValidationError(
      "Minimum price cannot be greater than maximum price.",
    );
  }

  return {
    query,
    category,
    minPriceCents,
    maxPriceCents,
    sort: parseSort(input.sort ?? null),
    page: parsePage(input.page ?? null),
    pageSize: parsePageSize(input.pageSize ?? null, PRODUCTS_PER_PAGE, 48),
  };
}

function productSort(sort: ProductFilters["sort"]): Sort {
  switch (sort) {
    case "newest":
      return { createdAt: -1, _id: -1 };
    case "price-asc":
      return { priceInCents: 1, _id: 1 };
    case "price-desc":
      return { priceInCents: -1, _id: 1 };
    case "rating-desc":
      return { ratingAverage: -1, ratingCount: -1, _id: 1 };
    case "name-asc":
      return { name: 1, _id: 1 };
    case "featured":
    default:
      return { featured: -1, createdAt: -1, _id: -1 };
  }
}

export async function listProducts(
  query: ProductQueryInput = {},
): Promise<ProductListResult> {
  const filters = normalizeProductFilters(query);
  const filter: Filter<ProductDoc> = {};

  if (!query.includeInactive) {
    filter.active = true;
  }

  if (query.featured) {
    filter.featured = true;
  }

  if (filters.query) {
    const regex = new RegExp(escapeRegex(filters.query), "i");
    filter.$or = [
      { name: regex },
      { summary: regex },
      { description: regex },
      { tags: regex },
      { sku: regex },
    ];
  }

  let categoryMissing = false;

  if (filters.category) {
    const category = await categoriesCollection.findOne({
      slug: filters.category,
      ...(query.includeInactive ? {} : { active: true }),
    });

    if (!category) {
      categoryMissing = true;
    } else {
      filter.categoryId = category._id;
    }
  }

  if (filters.minPriceCents !== null) {
    filter.priceInCents = { $gte: filters.minPriceCents };
  }

  if (filters.maxPriceCents !== null) {
    filter.priceInCents = {
      $gte: filters.minPriceCents ?? 0,
      $lte: filters.maxPriceCents,
    };
  }

  if (categoryMissing) {
    return {
      products: [],
      filters,
      total: 0,
      totalPages: 0,
    };
  }

  const skip = (filters.page - 1) * filters.pageSize;
  const [total, documents] = await Promise.all([
    productsCollection.countDocuments(filter),
    productsCollection
      .find(filter)
      .sort(productSort(filters.sort))
      .skip(skip)
      .limit(filters.pageSize)
      .toArray(),
  ]);

  const categories = await getCategoriesById(
    documents.map((product) => product.categoryId),
  );

  return {
    products: documents.map((product) =>
      serializeProduct(
        product,
        categories.get(product.categoryId.toHexString()) ?? null,
      ),
    ),
    filters,
    total,
    totalPages: total === 0 ? 0 : Math.ceil(total / filters.pageSize),
  };
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const result = await listProducts({
    featured: true,
    sort: "featured",
    pageSize: String(Math.min(Math.max(limit, 1), 24)),
  });

  return result.products;
}

export async function getProductBySlug(
  slug: string,
  options: { includeInactive?: boolean } = {},
): Promise<Product | null> {
  if (!slug) {
    return null;
  }

  const product = await productsCollection.findOne({ slug });

  if (!product || (!options.includeInactive && !product.active)) {
    return null;
  }

  const category = await categoriesCollection.findOne({
    _id: product.categoryId,
  });

  return serializeProduct(product, category);
}

export async function getProductById(
  id: string,
  options: { includeInactive?: boolean } = {},
): Promise<Product | null> {
  let objectId;

  try {
    objectId = parseObjectId(id, "Product ID");
  } catch {
    return null;
  }

  const product = await productsCollection.findOne({ _id: objectId });

  if (!product || (!options.includeInactive && !product.active)) {
    return null;
  }

  const category = await categoriesCollection.findOne({
    _id: product.categoryId,
  });

  return serializeProduct(product, category);
}

export async function getRelatedProducts(
  product: Product,
  limit = 3,
): Promise<Product[]> {
  if (!product.category) {
    const result = await listProducts({
      sort: "featured",
      pageSize: String(limit + 1),
    });
    return result.products.filter((entry) => entry.id !== product.id).slice(0, limit);
  }

  const sameCategory = await productsCollection
    .find({
      _id: { $ne: parseObjectId(product.id, "Product ID") },
      categoryId: parseObjectId(product.category.id, "Category ID"),
      active: true,
    })
    .sort({ featured: -1, ratingAverage: -1, createdAt: -1 })
    .limit(limit)
    .toArray();

  if (sameCategory.length >= limit) {
    const category = await categoriesCollection.findOne({
      _id: parseObjectId(product.category.id, "Category ID"),
    });

    return sameCategory.map((item) =>
      serializeProduct(item, category ?? null),
    );
  }

  const existingIds = sameCategory.map((item) => item._id);
  const fill = await productsCollection
    .find({
      _id: {
        $nin: [
          parseObjectId(product.id, "Product ID"),
          ...existingIds,
        ],
      },
      active: true,
    })
    .sort({ featured: -1, ratingAverage: -1, createdAt: -1 })
    .limit(limit - sameCategory.length)
    .toArray();

  const documents = [...sameCategory, ...fill];
  const categories = await getCategoriesById(
    documents.map((item) => item.categoryId),
  );

  return documents.map((item) =>
    serializeProduct(
      item,
      categories.get(item.categoryId.toHexString()) ?? null,
    ),
  );
}

type ProductFields = {
  name: string;
  slug: string;
  sku: string;
  summary: string;
  description: string;
  highlights: string[];
  tags: string[];
  priceInCents: number;
  compareAtPriceInCents: number | null;
  categoryId: ProductDoc["categoryId"];
  images: string[];
  stock: number;
  badge: ProductBadge | null;
  featured: boolean;
  active: boolean;
};

function has(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

async function parseProductFields(
  rawValue: unknown,
  existing?: ProductDoc,
): Promise<ProductFields> {
  const raw = asRecord(rawValue);
  const priceInCents = has(raw, "priceInCents")
    ? readPriceCents(raw.priceInCents, "Price")
    : existing?.priceInCents;

  if (priceInCents === undefined) {
    throw new ValidationError("Price is required.");
  }

  const compareAtPriceInCents = has(raw, "compareAtPriceInCents")
    ? readOptionalPriceCents(raw.compareAtPriceInCents)
    : (existing?.compareAtPriceInCents ?? null);

  if (
    compareAtPriceInCents !== null &&
    compareAtPriceInCents <= priceInCents
  ) {
    throw new ValidationError(
      "Compare-at price must be greater than the current price.",
    );
  }

  const categoryId = has(raw, "categoryId")
    ? parseObjectId(raw.categoryId, "Category")
    : existing?.categoryId;

  if (!categoryId) {
    throw new ValidationError("Category is required.");
  }

  const category = await categoriesCollection.findOne({ _id: categoryId });

  if (!category) {
    throw new ValidationError("The selected category does not exist.");
  }

  const badge = has(raw, "badge")
    ? raw.badge === null || raw.badge === ""
      ? null
      : readEnum(raw.badge, ["bestseller", "new", "limited"] as const, "Badge")
    : (existing?.badge ?? null);

  return {
    name: has(raw, "name")
      ? readString(raw.name, { label: "Name", max: 120 })
      : requireExisting(existing?.name, "Name"),
    slug: has(raw, "slug")
      ? normalizeSlug(raw.slug)
      : requireExisting(existing?.slug, "Slug"),
    sku: has(raw, "sku")
      ? readString(raw.sku, {
          label: "SKU",
          max: 40,
          pattern: /^[A-Za-z0-9._-]+$/,
          patternMessage: "SKU can use letters, numbers, dots, dashes, and underscores.",
        }).toUpperCase()
      : requireExisting(existing?.sku, "SKU"),
    summary: has(raw, "summary")
      ? readString(raw.summary, { label: "Summary", max: 240 })
      : requireExisting(existing?.summary, "Summary"),
    description: has(raw, "description")
      ? readString(raw.description, { label: "Description", max: 5_000 })
      : requireExisting(existing?.description, "Description"),
    highlights: has(raw, "highlights")
      ? readStringArray(raw.highlights, {
          label: "Highlights",
          maxItems: 8,
          maxLength: 200,
        })
      : (existing?.highlights ?? []),
    tags: has(raw, "tags")
      ? readStringArray(raw.tags, {
          label: "Tags",
          maxItems: 12,
          maxLength: 40,
        }).map((tag) => tag.toLowerCase())
      : (existing?.tags ?? []),
    priceInCents,
    compareAtPriceInCents,
    categoryId,
    images: has(raw, "images")
      ? validateImageUrls(raw.images)
      : (existing?.images ?? []),
    stock: has(raw, "stock")
      ? readInt(raw.stock, { label: "Stock", min: 0, max: 1_000_000 })
      : requireExisting(existing?.stock, "Stock"),
    badge,
    featured: has(raw, "featured")
      ? readBoolean(raw.featured, "Featured")
      : Boolean(existing?.featured),
    active: has(raw, "active")
      ? readBoolean(raw.active, "Active")
      : (existing?.active ?? true),
  };
}

function requireExisting<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new ValidationError(`${label} is required.`);
  }

  return value;
}

export async function createProduct(raw: unknown): Promise<Product> {
  const fields = await parseProductFields(raw);
  const now = new Date();

  const document: ProductDoc = {
    _id: new ObjectId(),
    ...fields,
    ratingAverage: 0,
    ratingCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await productsCollection.insertOne(document);

  const category = await categoriesCollection.findOne({
    _id: document.categoryId,
  });

  return serializeProduct(document, category);
}

export async function updateProduct(
  id: string,
  raw: unknown,
): Promise<Product> {
  const productId = parseObjectId(id, "Product ID");
  const existing = await productsCollection.findOne({ _id: productId });

  if (!existing) {
    throw notFound("Product not found.");
  }

  const fields = await parseProductFields(raw, existing);
  const updatedAt = new Date();

  await productsCollection.updateOne(
    { _id: productId },
    { $set: { ...fields, updatedAt } },
  );

  const updated = await productsCollection.findOne({ _id: productId });
  const category = updated
    ? await categoriesCollection.findOne({ _id: updated.categoryId })
    : null;

  return serializeProduct(updated ?? existing, category);
}

export async function setProductActive(
  id: string,
  active: boolean,
): Promise<Product> {
  return updateProduct(id, { active });
}

export async function recalculateProductRating(productId: ProductDoc["_id"]) {
  const [summary] = await reviewsCollection
    .aggregate<{ average: number; count: number }>([
      { $match: { productId } },
      {
        $group: {
          _id: "$productId",
          average: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray();

  await productsCollection.updateOne(
    { _id: productId },
    {
      $set: {
        ratingAverage: summary ? Math.round(summary.average * 10) / 10 : 0,
        ratingCount: summary?.count ?? 0,
        updatedAt: new Date(),
      },
    },
  );
}

export async function assertProductSlugAvailable(
  slug: string,
  exceptId?: ProductDoc["_id"],
) {
  const existing = await productsCollection.findOne({ slug });

  if (existing && (!exceptId || !existing._id.equals(exceptId))) {
    throw conflict("A product with that slug already exists.");
  }
}
