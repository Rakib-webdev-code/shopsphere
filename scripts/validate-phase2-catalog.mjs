/** Source-only validation; it deliberately does not load MongoDB configuration. */
import { readFileSync, existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { seedCategories, seedProducts } from "./seed-data.mjs";

const catalogPath = join(process.cwd(), "data", "catalog-phase2-products.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const errors = [];
const categoryMap = new Map(seedCategories.map((category) => [category.slug, category]));
const categoryCounts = Object.fromEntries(seedCategories.map(({ slug }) => [slug, 0]));
const sourceKeys = new Set(seedProducts.flatMap((product) => [
  `name:${product.name.normalize("NFKC").trim().toLowerCase()}`,
  `slug:${product.slug.toLowerCase()}`,
  `sku:${product.sku.toLowerCase()}`,
]));
const seen = new Set();

if (catalog.format !== "shopsphere-phase2-catalog-draft-v1") errors.push("Unsupported catalog format.");
if (catalog.baseline?.sourceProducts !== seedProducts.length) errors.push("Source product baseline differs from scripts/seed-data.mjs.");
if (catalog.baseline?.liveDatabaseCount !== null) errors.push("Live database count must remain unknown in this source-only artifact.");
if (catalog.categories?.length !== seedCategories.length) errors.push("Category list must contain exactly the existing source categories.");
if (catalog.products?.length !== 150) errors.push(`Expected 150 additional products; found ${catalog.products?.length ?? "none"}.`);

const publicRoot = resolve(process.cwd(), "public");
for (const [index, product] of (catalog.products ?? []).entries()) {
  const label = `products[${index}]`;
  const category = categoryMap.get(product.categorySlug);
  if (!category) errors.push(`${label}: categorySlug must match an existing category.`);
  else categoryCounts[category.slug] += 1;
  if (typeof product.name !== "string" || !product.name.trim() || product.name.length > 120) errors.push(`${label}: invalid name.`);
  if (typeof product.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug) || product.slug.length > 160) errors.push(`${label}: invalid slug.`);
  if (typeof product.sku !== "string" || product.sku.length > 40 || !/^[A-Za-z0-9._-]+$/.test(product.sku)) errors.push(`${label}: invalid SKU.`);
  if (typeof product.summary !== "string" || !product.summary.trim() || product.summary.length > 240) errors.push(`${label}: invalid summary.`);
  if (typeof product.description !== "string" || !product.description.trim() || product.description.length > 5000) errors.push(`${label}: invalid description.`);
  if (!Array.isArray(product.highlights) || product.highlights.length > 8 || product.highlights.some((value) => typeof value !== "string" || !value.trim() || value.length > 200)) errors.push(`${label}: invalid highlights.`);
  if (!Array.isArray(product.tags) || product.tags.length > 12 || product.tags.some((value) => typeof value !== "string" || !value.trim() || value.length > 40)) errors.push(`${label}: invalid tags.`);
  if (!Number.isInteger(product.priceInCents) || product.priceInCents < 0 || product.priceInCents > 10_000_000) errors.push(`${label}: invalid priceInCents.`);
  if (product.compareAtPriceInCents !== null && (!Number.isInteger(product.compareAtPriceInCents) || product.compareAtPriceInCents <= product.priceInCents || product.compareAtPriceInCents > 10_000_000)) errors.push(`${label}: invalid compareAtPriceInCents.`);
  if (!Number.isInteger(product.stock) || product.stock < 0 || product.stock > 1_000_000) errors.push(`${label}: invalid stock.`);
  if (product.badge !== null && !["bestseller", "new", "limited"].includes(product.badge)) errors.push(`${label}: invalid badge.`);
  if (typeof product.featured !== "boolean" || typeof product.active !== "boolean") errors.push(`${label}: featured and active must be booleans.`);
  if (product.active !== false || product.stock !== 0) errors.push(`${label}: draft products must remain inactive with zero unverified stock.`);
  if (!Array.isArray(product.images) || product.images.length > 6) errors.push(`${label}: invalid images list.`);

  const keys = [
    `name:${String(product.name ?? "").normalize("NFKC").trim().toLowerCase()}`,
    `slug:${String(product.slug ?? "").toLowerCase()}`,
    `sku:${String(product.sku ?? "").toLowerCase()}`,
  ];
  for (const key of keys) {
    if (sourceKeys.has(key)) errors.push(`${label}: duplicates source ${key}.`);
    if (seen.has(key)) errors.push(`${label}: duplicates another draft ${key}.`);
    seen.add(key);
  }

  for (const image of product.images ?? []) {
    if (typeof image !== "string" || !image.startsWith("/")) {
      errors.push(`${label}: image must be a local absolute path.`);
      continue;
    }
    const filePath = resolve(publicRoot, `.${image}`);
    const rel = relative(publicRoot, filePath);
    if (isAbsolute(rel) || rel === ".." || rel.startsWith(`..${sep}`) || !existsSync(filePath)) {
      errors.push(`${label}: image asset is missing or escapes public/: ${image}`);
    }
  }
}

for (const sourceCategory of seedCategories) {
  const artifactCategory = catalog.categories?.find((category) => category.slug === sourceCategory.slug);
  if (!artifactCategory || artifactCategory.name !== sourceCategory.name) errors.push(`Category identity mismatch: ${sourceCategory.slug}.`);
}

const totalPrepared = seedProducts.length + (catalog.products?.length ?? 0);
console.log(JSON.stringify({
  mode: "source-only dry-run",
  sourceProducts: seedProducts.length,
  additionalProducts: catalog.products?.length ?? 0,
  sourceBasedPreparedTotal: totalPrepared,
  liveDatabaseCount: "unknown (not queried)",
  categoryCounts: Object.fromEntries(seedCategories.map(({ slug }) => [slug, {
    existingSource: seedProducts.filter((product) => product.categorySlug === slug).length,
    additionalDraft: categoryCounts[slug],
    sourceBasedTotal: seedProducts.filter((product) => product.categorySlug === slug).length + categoryCounts[slug],
  }])),
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;
