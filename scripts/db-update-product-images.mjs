/**
 * Repeat-safe image update for the sample catalog.
 *
 * The script only touches `images` and `updatedAt` on products that still
 * carry the original local SVG artwork. Products with customer- or
 * admin-managed images are left untouched. Run without flags for a dry run.
 *
 *   npm run db:update-product-images -- --verify
 *   npm run db:update-product-images -- --apply --verify
 */
import {
  SEED_SOURCE,
  seedProducts,
} from "./seed-data.mjs";
import { productImages } from "./product-images.mjs";
import { getDatabase, printDatabaseName } from "./db-utils.mjs";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const verify = args.has("--verify");

/**
 * The original seed used a handful of shorter SVG filenames. Every other
 * product used `/products/<slug>.svg`.
 */
const LEGACY_IMAGE_OVERRIDES = {
  "halo-wireless-headphones": ["/products/halo-headphones.svg"],
  "pebble-portable-speaker": ["/products/pebble-speaker.svg"],
  "arc-desk-lamp": ["/products/arc-lamp.svg"],
  "tactile-mechanical-keyboard": ["/products/tactile-keyboard.svg"],
  "daily-ceramic-mug": ["/products/daily-mug.svg"],
  "woven-cotton-throw": ["/products/woven-throw.svg"],
  "field-day-backpack": ["/products/field-backpack.svg"],
  "minimal-steel-watch": ["/products/steel-watch.svg"],
  "summit-water-bottle": ["/products/summit-bottle.svg"],
  "cloudstep-sneakers": ["/products/cloudstep-sneaker.svg"],
  "still-room-diffuser": ["/products/still-diffuser.svg"],
};

function legacyImagesFor(slug) {
  return LEGACY_IMAGE_OVERRIDES[slug] ?? [`/products/${slug}.svg`];
}

function sameImages(a, b) {
  return (
    Array.isArray(a) &&
    Array.isArray(b) &&
    a.length === b.length &&
    a.every((value, index) => value === b[index])
  );
}

const seedProductsBySlug = new Map(
  seedProducts.map((product) => [product.slug, product]),
);

async function verifyImage(url) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/avif,image/webp,image/*,*/*;q=0.8",
          "User-Agent": "ShopSphere catalog image check",
        },
        redirect: "follow",
      });
      const type = response.headers.get("content-type") ?? "";
      const ok = response.ok && type.startsWith("image/");
      await response.body?.cancel();

      if (ok) {
        return null;
      }

      if (attempt === 2) {
        return `HTTP ${response.status} (${type || "no content-type"})`;
      }
    } catch (error) {
      if (attempt === 2) {
        return error.message;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
}

async function verifyAll(entries) {
  const failures = [];
  let cursor = 0;

  await Promise.all(
    Array.from({ length: 6 }, async () => {
      while (cursor < entries.length) {
        const index = cursor;
        cursor += 1;
        const [slug, urls] = entries[index];
        const failure = await verifyImage(urls[0]);

        if (failure) {
          failures.push(`${slug}: ${failure}`);
        }
      }
    }),
  );

  return failures;
}

const { client, db } = getDatabase();
const products = db.collection("products");

try {
  await db.command({ ping: 1 });
  printDatabaseName(db);

  const entries = Object.entries(productImages);

  if (verify) {
    console.log(`Checking ${entries.length} image URLs...`);
    const failures = await verifyAll(entries);

    if (failures.length > 0) {
      console.error(`Image verification failed for ${failures.length} URL(s):`);
      for (const failure of failures) {
        console.error(`- ${failure}`);
      }
      process.exitCode = 1;
      throw new Error("Aborting before any database writes.");
    }

    console.log("All image URLs returned an image response.");
  } else if (apply) {
    console.warn(
      "Applying without --verify. Run with --verify to check every URL first.",
    );
  }

  const documents = await products
    .find(
      { slug: { $in: entries.map(([slug]) => slug) } },
      {
        projection: {
          _id: 1,
          slug: 1,
          sku: 1,
          seedKey: 1,
          images: 1,
        },
      },
    )
    .toArray();
  const documentsBySlug = new Map(documents.map((doc) => [doc.slug, doc]));

  const pending = [];
  const alreadyCurrent = [];
  const missing = [];
  const skipped = [];

  for (const [slug, newImages] of entries) {
    const document = documentsBySlug.get(slug);
    const seedProduct = seedProductsBySlug.get(slug);
    const expectedSeedKey = `${SEED_SOURCE}:product:${slug}`;

    if (!document) {
      missing.push(slug);
      continue;
    }

    const ownedBySeed =
      document.seedKey === expectedSeedKey ||
      (!document.seedKey &&
        seedProduct &&
        document.sku === seedProduct.sku);

    if (!ownedBySeed) {
      skipped.push(`${slug} (not owned by the sample seed)`);
      continue;
    }

    if (sameImages(document.images, newImages)) {
      alreadyCurrent.push(slug);
      continue;
    }

    const legacyImages = legacyImagesFor(slug);

    if (!sameImages(document.images, legacyImages)) {
      skipped.push(`${slug} (images were changed outside the seed)`);
      continue;
    }

    pending.push({ document, slug, newImages, legacyImages });
  }

  console.log(
    `Matched ${documents.length} product(s): ${pending.length} to update, ${alreadyCurrent.length} already current, ${skipped.length} skipped, ${missing.length} missing.`,
  );

  for (const reason of skipped) {
    console.warn(`Skipped ${reason}.`);
  }

  for (const slug of missing) {
    console.warn(`Missing product ${slug}.`);
  }

  if (pending.length === 0) {
    console.log("Nothing to update.");
  } else if (!apply) {
    console.log("Dry run only. Re-run with --apply to write these changes:");
    for (const { slug } of pending) {
      console.log(`- ${slug}`);
    }
  } else {
    const now = new Date();
    let updated = 0;
    let changedMeanwhile = 0;

    for (const { document, slug, newImages, legacyImages } of pending) {
      const result = await products.updateOne(
        { _id: document._id, images: legacyImages },
        { $set: { images: newImages, updatedAt: now } },
      );

      if (result.modifiedCount === 1) {
        updated += 1;
      } else {
        changedMeanwhile += 1;
        console.warn(
          `Skipped ${slug}: its images changed while the update was running.`,
        );
      }
    }

    console.log(
      `Updated ${updated} product image set(s). ${changedMeanwhile} changed concurrently and were left alone.`,
    );
    console.log(
      "Only the images and updatedAt fields of seed-owned products were changed.",
    );
  }
} catch (error) {
  console.error("Product image update failed:", error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
