import { ObjectId, type Filter, type Sort } from "mongodb";
import {
  categoriesCollection,
  inventoryAdjustmentsCollection,
  productsCollection,
  reviewsCollection,
} from "@/lib/db/collections";
import type {
  CategoryDoc,
  ProductDoc,
  StockAdjustmentDoc,
} from "@/lib/db/types";
import {
  ApiError,
  conflict,
  forbidden,
  notFound,
  ValidationError,
} from "@/lib/errors";
import type { CurrentUser } from "@/lib/auth/session";
import { runRequiredTransaction } from "@/lib/db/transactions";
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

/**
 * Storefront reads exclude products in inactive categories even if a racing
 * write left `product.active` true. This is the read-side half of the catalog
 * invariant; the write-side repair and post-deactivation sweep keep the data
 * consistent, but a request can still land in the tiny window between them.
 */
async function getActiveCategoryIds(): Promise<ObjectId[]> {
  const categories = await categoriesCollection
    .find({ active: true }, { projection: { _id: 1 } })
    .toArray();

  return categories.map((category) => category._id);
}

function categoryConflict(
  message = "The category was deactivated while saving. Refresh and try again.",
) {
  return new ApiError(409, message, "CATALOG_CONFLICT");
}

/**
 * Re-reads the category after a product write. Deactivation can race with the
 * pre-write check, so the write is only reported as successful when the
 * category is still active.
 *
 * The repair is conditional on `updatedAt` matching the document this request
 * wrote: a newer intentional admin edit wins, and that edit performs its own
 * post-write verification.
 */
async function verifyProductCategory(
  product: ProductDoc,
  writtenUpdatedAt: Date,
): Promise<void> {
  if (!product.active) {
    return;
  }

  let category: CategoryDoc | null;

  try {
    category = await categoriesCollection.findOne({ _id: product.categoryId });
  } catch (error) {
    // The category state is unknown. Fail closed by taking our own write out
    // of the storefront rather than risking a purchasable product in an
    // inactive category.
    await productsCollection
      .updateOne(
        {
          _id: product._id,
          active: true,
          updatedAt: writtenUpdatedAt,
        },
        { $set: { active: false, updatedAt: new Date() } },
      )
      .catch(() => undefined);
    throw error;
  }

  if (!category || category.active) {
    return;
  }

  const repaired = await productsCollection.updateOne(
    { _id: product._id, active: true, updatedAt: writtenUpdatedAt },
    { $set: { active: false, updatedAt: new Date() } },
  );

  if (repaired.modifiedCount !== 1) {
    // A newer write superseded this one. It owns its own verification, but
    // this request must not report a stale success.
    throw categoryConflict();
  }

  throw categoryConflict(
    "The category was deactivated while saving. The product was left inactive; select an active category and try again.",
  );
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
  const activeCategoryIds = query.includeInactive
    ? null
    : await getActiveCategoryIds();

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
  } else if (activeCategoryIds) {
    // No explicit category filter: never list products from inactive
    // categories. Products with a dangling categoryId are also excluded,
    // which is the safe choice for a storefront.
    filter.categoryId = { $in: activeCategoryIds };
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

  if (!options.includeInactive && category && !category.active) {
    return null;
  }

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

  if (!options.includeInactive && category && !category.active) {
    return null;
  }

  return serializeProduct(product, category);
}

export async function getActiveProductLinks(
  productIds: string[],
): Promise<Map<string, string>> {
  const ids: ObjectId[] = [];

  for (const id of productIds) {
    try {
      ids.push(parseObjectId(id, "Product ID"));
    } catch {
      // Invalid historical IDs simply render without a product link.
    }
  }

  if (ids.length === 0) {
    return new Map();
  }

  const products = await productsCollection
    .find(
      { _id: { $in: ids }, active: true },
      { projection: { slug: 1, categoryId: 1 } },
    )
    .toArray();
  const categories = await getCategoriesById(
    products.map((product) => product.categoryId),
  );

  return new Map(
    products
      // Historical orders keep their snapshot. A link is offered only while
      // the live product and its category are still purchasable; missing
      // categories are tolerated for legacy data.
      .filter((product) => {
        const category = categories.get(product.categoryId.toHexString());
        return !category || category.active;
      })
      .map((product) => [
        product._id.toHexString(),
        `/shop/${product.slug}`,
      ]),
  );
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

  const categoryId = parseObjectId(product.category.id, "Category ID");
  const category = await categoriesCollection.findOne({ _id: categoryId });
  const sameCategoryActive = Boolean(category?.active);
  const sameCategory = sameCategoryActive
    ? await productsCollection
        .find({
          _id: { $ne: parseObjectId(product.id, "Product ID") },
          categoryId,
          active: true,
        })
        .sort({ featured: -1, ratingAverage: -1, createdAt: -1 })
        .limit(limit)
        .toArray()
    : [];

  if (sameCategory.length >= limit) {
    return sameCategory.map((item) =>
      serializeProduct(item, category ?? null),
    );
  }

  const activeCategoryIds = await getActiveCategoryIds();
  const existingIds = sameCategory.map((item) => item._id);
  const fill = await productsCollection
    .find({
      _id: {
        $nin: [
          parseObjectId(product.id, "Product ID"),
          ...existingIds,
        ],
      },
      categoryId: { $in: activeCategoryIds },
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

  const active = has(raw, "active")
    ? readBoolean(raw.active, "Active")
    : (existing?.active ?? true);

  if (active && !category.active) {
    throw new ValidationError(
      "Cannot activate a product in an inactive category.",
    );
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
    // Stock is only accepted when a product is created. Updates preserve the
    // current value here and omit it from the `$set` below; manual changes must
    // go through the guarded inventory adjustment service.
    stock: existing
      ? existing.stock
      : readInt(raw.stock, { label: "Stock", min: 0, max: 1_000_000 }),
    badge,
    featured: has(raw, "featured")
      ? readBoolean(raw.featured, "Featured")
      : Boolean(existing?.featured),
    active,
  };
}

function requireExisting<T>(value: T | undefined, label: string): T {
  if (value === undefined || value === null) {
    throw new ValidationError(`${label} is required.`);
  }

  return value;
}

export async function createProduct(
  raw: unknown,
  admin: CurrentUser,
): Promise<Product> {
  if (admin.role !== "admin") {
    throw forbidden("Administrator access is required.");
  }

  const fields = await parseProductFields(raw);
  const now = new Date();
  const _id = new ObjectId();
  const category = await categoriesCollection.findOne({ _id: fields.categoryId });

  if (!category) {
    throw new ValidationError("The selected category does not exist.");
  }

  const document: ProductDoc = {
    _id,
    ...fields,
    ratingAverage: 0,
    ratingCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  if (fields.stock > 0) {
    const adjustment: StockAdjustmentDoc = {
      _id: new ObjectId(),
      productId: _id,
      adminUserId: admin.id,
      kind: "initial",
      delta: fields.stock,
      beforeStock: 0,
      afterStock: fields.stock,
      reason: "Initial stock on product creation",
      at: now,
    };

    await runRequiredTransaction(async (session) => {
      await productsCollection.insertOne(document, { session });
      await inventoryAdjustmentsCollection.insertOne(adjustment, { session });
      return document;
    });
  } else {
    // Zero stock is not a stock change, so no initial adjustment is recorded.
    await productsCollection.insertOne(document);
  }

  // The pre-write category check can lose a race with deactivation. Verify the
  // category after the write and repair/409 rather than reporting success.
  await verifyProductCategory(document, now);

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
  const { stock: ignoredStock, ...editableFields } = fields;
  void ignoredStock;
  const updatedAt = new Date();

  // `stock` is deliberately excluded. Writing it here would overwrite a
  // concurrent checkout/reservation with the value read before this request.
  await productsCollection.updateOne(
    { _id: productId },
    { $set: { ...editableFields, updatedAt } },
  );

  const updated = await productsCollection.findOne({ _id: productId });
  const current = updated ?? existing;

  await verifyProductCategory(current, updatedAt);

  const category = await categoriesCollection.findOne({
    _id: current.categoryId,
  });

  return serializeProduct(current, category);
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
