import { ObjectId } from "mongodb";
import { ensureIndexes, getDatabase, printDatabaseName } from "./db-utils.mjs";
import {
  SEED_SOURCE,
  seedCategories,
  seedCoupons,
  seedProducts,
} from "./seed-data.mjs";

const { client, db } = getDatabase();

const categories = db.collection("categories");
const products = db.collection("products");
const coupons = db.collection("coupons");

function seedKeyFor(kind, slug) {
  return `${SEED_SOURCE}:${kind}:${slug}`;
}

/**
 * Find or create a seed-owned category.
 *
 * New records are identified by seedKey, never by name alone. The original
 * six categories predate seedKey, so they are adopted only when the slug and
 * display name still match exactly. Adoption adds the marker field and does
 * not overwrite any existing category data.
 */
async function ensureCategory(category) {
  const seedKey = seedKeyFor("category", category.slug);
  const byKey = await categories.findOne(
    { seedKey },
    { projection: { _id: 1 } },
  );

  if (byKey) {
    return { id: byKey._id, created: false, adopted: false };
  }

  const { legacy, ...fields } = category;
  const bySlug = await categories.findOne({ slug: fields.slug });

  if (bySlug) {
    if (legacy && bySlug.name === fields.name && !bySlug.seedKey) {
      await categories.updateOne(
        { _id: bySlug._id, seedKey: { $exists: false } },
        { $set: { seedKey } },
      );

      return { id: bySlug._id, created: false, adopted: true };
    }

    return {
      id: null,
      created: false,
      adopted: false,
      conflict: `slug "${fields.slug}" is already used by a category this seed does not own`,
    };
  }

  const now = new Date();
  const result = await categories.updateOne(
    { seedKey },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        ...fields,
        seedKey,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  const saved = await categories.findOne({ seedKey }, { projection: { _id: 1 } });

  if (!saved) {
    throw new Error(`Category ${fields.slug} could not be read after seeding.`);
  }

  return { id: saved._id, created: result.upsertedCount === 1, adopted: false };
}

/**
 * Find or create a seed-owned product.
 *
 * The original twelve products predate seedKey, so they are adopted only when
 * the slug and SKU still match. Every other insert is matched by seedKey, so
 * a user-created product with the same name can never be treated as seed-owned.
 */
async function ensureProduct(product, categoryId) {
  const seedKey = seedKeyFor("product", product.slug);
  const byKey = await products.findOne({ seedKey }, { projection: { _id: 1 } });

  if (byKey) {
    return { created: false, adopted: false };
  }

  const fields = { ...product };
  delete fields.categorySlug;
  delete fields.legacy;
  const bySlug = await products.findOne(
    { slug: fields.slug },
    { projection: { _id: 1, sku: 1, seedKey: 1 } },
  );

  if (bySlug) {
    if (product.legacy && bySlug.sku === fields.sku && !bySlug.seedKey) {
      await products.updateOne(
        { _id: bySlug._id, seedKey: { $exists: false } },
        { $set: { seedKey } },
      );

      return { created: false, adopted: true };
    }

    return {
      created: false,
      adopted: false,
      conflict: `slug "${fields.slug}" is already used by a product this seed does not own`,
    };
  }

  const now = new Date();
  const result = await products.updateOne(
    { seedKey },
    {
      $setOnInsert: {
        _id: new ObjectId(),
        ...fields,
        categoryId,
        seedKey,
        ratingAverage: 0,
        ratingCount: 0,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    },
    { upsert: true },
  );

  return { created: result.upsertedCount === 1, adopted: false };
}

try {
  await db.command({ ping: 1 });
  printDatabaseName(db);
  await ensureIndexes(db);

  const categoryIds = new Map();
  const skippedCategories = new Set();
  let categoriesCreated = 0;
  let categoriesAdopted = 0;

  for (const category of seedCategories) {
    const result = await ensureCategory(category);

    if (result.conflict) {
      skippedCategories.add(category.slug);
      console.warn(`Skipped category ${category.slug}: ${result.conflict}.`);
      continue;
    }

    categoryIds.set(category.slug, result.id);

    if (result.created) {
      categoriesCreated += 1;
    }

    if (result.adopted) {
      categoriesAdopted += 1;
    }
  }

  let productsCreated = 0;
  let productsAdopted = 0;
  let productsSkipped = 0;

  for (const product of seedProducts) {
    if (skippedCategories.has(product.categorySlug)) {
      productsSkipped += 1;
      continue;
    }

    const categoryId = categoryIds.get(product.categorySlug);

    if (!categoryId) {
      throw new Error(`Missing seeded category ${product.categorySlug}.`);
    }

    const result = await ensureProduct(product, categoryId);

    if (result.conflict) {
      productsSkipped += 1;
      console.warn(`Skipped product ${product.slug}: ${result.conflict}.`);
      continue;
    }

    if (result.created) {
      productsCreated += 1;
    }

    if (result.adopted) {
      productsAdopted += 1;
    }
  }

  let couponsCreated = 0;
  const now = new Date();

  for (const coupon of seedCoupons) {
    const result = await coupons.updateOne(
      { code: coupon.code },
      {
        $setOnInsert: {
          _id: new ObjectId(),
          ...coupon,
          usedCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      couponsCreated += 1;
    }
  }

  const [activeProductCount, categoryCount] = await Promise.all([
    products.countDocuments({ active: true }),
    categories.countDocuments({ active: true }),
  ]);

  console.log(
    `Sample seed complete: ${categoriesCreated} categories and ${productsCreated} products inserted, ${couponsCreated} coupons inserted.`,
  );
  console.log(
    `Existing seed records adopted with a seedKey: ${categoriesAdopted} categories and ${productsAdopted} products. Existing product data was not overwritten.`,
  );

  if (productsSkipped > 0) {
    console.log(
      `${productsSkipped} products were skipped because their slug belongs to a document this seed does not own.`,
    );
  }

  console.log(
    `Catalog now contains ${activeProductCount} active products across ${categoryCount} active categories.`,
  );
  console.log(
    "No users, accounts, sessions, carts, orders, reviews, wishlists, addresses, or coupons were deleted or reset.",
  );
} catch (error) {
  console.error("Seeding failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
