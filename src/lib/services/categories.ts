import { ObjectId, type Filter } from "mongodb";
import {
  categoriesCollection,
  productsCollection,
} from "@/lib/db/collections";
import type { CategoryDoc } from "@/lib/db/types";
import { conflict, notFound, ValidationError } from "@/lib/errors";
import { PRODUCT_ICONS } from "@/lib/constants";
import type { Category, ProductIconName } from "@/lib/types";
import {
  asRecord,
  normalizeSlug,
  parseObjectId,
  readBoolean,
  readEnum,
  readString,
  validateImageUrl,
} from "@/lib/validation";

function serializeCategory(
  category: CategoryDoc,
  productCount: number,
): Category {
  return {
    id: category._id.toHexString(),
    name: category.name,
    slug: category.slug,
    tagline: category.tagline,
    description: category.description,
    icon: category.icon,
    imageUrl: category.imageUrl ?? null,
    active: Boolean(category.active),
    productCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function listCategories(
  options: { includeInactive?: boolean } = {},
): Promise<Category[]> {
  const filter: Filter<CategoryDoc> = options.includeInactive
    ? {}
    : { active: true };
  const categories = await categoriesCollection
    .find(filter)
    .sort({ name: 1 })
    .toArray();

  if (categories.length === 0) {
    return [];
  }

  const counts = await productsCollection
    .aggregate<{ _id: CategoryDoc["_id"]; count: number }>([
      {
        $match: {
          active: true,
          categoryId: { $in: categories.map((category) => category._id) },
        },
      },
      { $group: { _id: "$categoryId", count: { $sum: 1 } } },
    ])
    .toArray();

  const countMap = new Map(
    counts.map((entry) => [entry._id.toHexString(), entry.count]),
  );

  return categories.map((category) =>
    serializeCategory(
      category,
      countMap.get(category._id.toHexString()) ?? 0,
    ),
  );
}

export async function getCategoryBySlug(
  slug: string,
  options: { includeInactive?: boolean } = {},
): Promise<Category | null> {
  const category = await categoriesCollection.findOne({ slug });

  if (!category || (!options.includeInactive && !category.active)) {
    return null;
  }

  const productCount = await productsCollection.countDocuments({
    categoryId: category._id,
    active: true,
  });

  return serializeCategory(category, productCount);
}

export async function getCategoryById(
  id: string,
  options: { includeInactive?: boolean } = {},
): Promise<Category | null> {
  if (!ObjectId.isValid(id)) {
    return null;
  }

  const category = await categoriesCollection.findOne({
    _id: new ObjectId(id),
  });

  if (!category || (!options.includeInactive && !category.active)) {
    return null;
  }

  const productCount = await productsCollection.countDocuments({
    categoryId: category._id,
    active: true,
  });

  return serializeCategory(category, productCount);
}

async function parseCategoryFields(
  rawValue: unknown,
  existing?: CategoryDoc,
) {
  const raw = asRecord(rawValue);
  const has = (key: string) =>
    Object.prototype.hasOwnProperty.call(raw, key);

  const name = has("name")
    ? readString(raw.name, { label: "Name", max: 80 })
    : existing?.name;

  if (!name) {
    throw new ValidationError("Name is required.");
  }

  const tagline = has("tagline")
    ? readString(raw.tagline, { label: "Tagline", max: 140 })
    : (existing?.tagline ?? "");

  const description = has("description")
    ? readString(raw.description, { label: "Description", max: 1_000 })
    : (existing?.description ?? "");

  if (!tagline || !description) {
    throw new ValidationError("Tagline and description are required.");
  }

  const icon = has("icon")
    ? readEnum(
        raw.icon,
        PRODUCT_ICONS.map((entry) => entry.value),
        "Icon",
      )
    : (existing?.icon as ProductIconName | undefined);

  if (!icon) {
    throw new ValidationError("Icon is required.");
  }

  const imageUrl = has("imageUrl")
    ? raw.imageUrl === null || raw.imageUrl === ""
      ? null
      : validateImageUrl(raw.imageUrl, "Category image")
    : (existing?.imageUrl ?? null);

  return {
    name,
    slug: has("slug")
      ? normalizeSlug(raw.slug)
      : (existing?.slug ?? normalizeSlug(name)),
    tagline,
    description,
    icon,
    imageUrl,
    active: has("active")
      ? readBoolean(raw.active, "Active")
      : (existing?.active ?? true),
  };
}

export async function createCategory(raw: unknown): Promise<Category> {
  const fields = await parseCategoryFields(raw);
  const now = new Date();
  const document: CategoryDoc = {
    _id: new ObjectId(),
    ...fields,
    createdAt: now,
    updatedAt: now,
  };

  await categoriesCollection.insertOne(document);

  return serializeCategory(document, 0);
}

export async function updateCategory(
  id: string,
  raw: unknown,
): Promise<Category> {
  const categoryId = parseObjectId(id, "Category ID");
  const existing = await categoriesCollection.findOne({ _id: categoryId });

  if (!existing) {
    throw notFound("Category not found.");
  }

  const fields = await parseCategoryFields(raw, existing);
  const updatedAt = new Date();

  // Category deactivation preserves individual product.active states in the database.
  // Storefront browsing, product detail lookups, cart serialization, and checkout
  // lines already guard on category.active, making products unavailable while the
  // category is inactive without destructively erasing product settings.
  const filter: Filter<CategoryDoc> = { _id: categoryId };

  if (!fields.active) {
    filter.$or = [
      { checkoutReservations: { $exists: false } },
      { checkoutReservations: { $size: 0 } },
    ];
  }

  const result = await categoriesCollection.updateOne(
    filter,
    { $set: { ...fields, updatedAt } },
  );

  if (!result.matchedCount && !fields.active) {
    const current = await categoriesCollection.findOne({ _id: categoryId });

    if (current?.active && (current.checkoutReservations?.length ?? 0) > 0) {
      throw conflict(
        "This category has a checkout in progress. Try deactivating it again after checkout finishes.",
      );
    }
  }

  const updated = await categoriesCollection.findOne({ _id: categoryId });
  const productCount = await productsCollection.countDocuments({
    categoryId,
    active: true,
  });

  return serializeCategory(updated ?? existing, productCount);
}

export async function setCategoryActive(
  id: string,
  active: boolean,
): Promise<Category> {
  return updateCategory(id, { active });
}

export async function deleteOrDeactivateCategory(id: string) {
  // Categories are deactivated rather than deleted so product references stay valid.
  return setCategoryActive(id, false);
}
