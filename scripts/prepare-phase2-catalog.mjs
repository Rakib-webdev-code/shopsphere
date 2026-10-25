/**
 * Creates the reviewable Phase 2 catalog draft and clearly illustrative local
 * SVG artwork. It does not connect to MongoDB or modify the existing seed.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedCategories, seedProducts } from "./seed-data.mjs";

const entries = {
  audio: [
    ["Studio Monitor Headphones", 12900], ["Compact USB-C Audio Interface", 15900],
    ["Bookshelf Speaker Pair", 24900], ["Portable Bluetooth Radio", 8900],
    ["Wired In-Ear Monitor Set", 5900], ["Desktop Microphone Arm", 4500],
    ["Bluetooth Turntable", 28900], ["Wireless Headphone Stand", 3900],
    ["Stereo RCA Audio Cable", 1200], ["Portable DAC Headphone Amp", 9900],
  ],
  workspace: [
    ["Clamp-On Desk Lamp", 6900], ["Aluminum Laptop Riser", 5200],
    ["Compact Mechanical Keyboard", 8900], ["Vertical Wireless Mouse", 4200],
    ["A4 Desk Pad", 2500], ["Adjustable Monitor Shelf", 4900],
    ["USB-C Desk Hub", 5500], ["Stackable Document Tray", 2200],
    ["Task Chair Lumbar Cushion", 3600], ["Cable Management Box", 1800],
  ],
  home: [
    ["Cotton Waffle Throw", 5900], ["Stoneware Table Lamp", 9900],
    ["Linen Cushion Cover Set", 3400], ["Acacia Entryway Tray", 2800],
    ["Ceramic Bud Vase Pair", 3100], ["Cotton Bath Towel Set", 6500],
    ["Woven Storage Basket", 4200], ["Wall-Mounted Key Rail", 1900],
    ["Glass Bedside Carafe", 2600], ["Felt Drawer Organizer Set", 2400],
  ],
  accessories: [
    ["Canvas Travel Weekender", 7900], ["Slim Card Wallet", 3200],
    ["Braided Leather Key Loop", 1400], ["Travel Toiletry Organizer", 2900],
    ["Recycled Nylon Sling Bag", 5600], ["Analog Field Watch", 11900],
    ["Passport and Card Holder", 2700], ["Compact Folding Umbrella", 3800],
    ["Everyday Belt", 3500], ["Packing Cube Set", 3300],
  ],
  outdoor: [
    ["Insulated Trail Flask", 3600], ["Compact Folding Camp Stool", 5200],
    ["Rechargeable Headlamp", 3100], ["Waterproof Dry Bag", 2500],
    ["Lightweight Picnic Blanket", 4300], ["Stainless Camp Cook Set", 6900],
    ["Trail First-Aid Pouch", 2200], ["Foldable Trekking Poles", 7400],
    ["Packable Rain Shell", 8900], ["Clip-On Solar Lantern", 4100],
  ],
  wellness: [
    ["Cork Yoga Block Pair", 2400], ["Aromatherapy Oil Diffuser", 5900],
    ["Weighted Eye Pillow", 1800], ["Cotton Meditation Cushion", 4900],
    ["Stainless Gua Sha Tool", 2100], ["Rechargeable Sleep Sound Machine", 6500],
    ["Natural Bristle Body Brush", 1700], ["Stretching Strap", 1200],
    ["Ceramic Essential Oil Burner", 3300], ["Warm Light Reading Lamp", 4700],
  ],
  electronics: [
    ["Dual-Port USB-C Wall Charger", 3900], ["Compact 4K Webcam", 8900],
    ["Portable SSD Enclosure", 4200], ["Wi-Fi Smart Plug Pair", 3500],
    ["Wireless Charging Pad", 2900], ["HDMI Capture Adapter", 5900],
    ["USB-C to Ethernet Adapter", 2600], ["Rechargeable Motion Sensor Light", 3200],
    ["Portable Mini Projector", 32900], ["Bluetooth Trackpad", 6900],
  ],
  fashion: [
    ["Relaxed Cotton Oxford Shirt", 5900], ["Merino Crewneck Sweater", 10900],
    ["Linen Blend Wide-Leg Trousers", 7900], ["Cotton Poplin Overshirt", 6900],
    ["Ribbed Knit Beanie", 2200], ["Everyday Canvas Apron", 3100],
    ["Lightweight Quilted Vest", 9900], ["Textured Cotton Polo", 4800],
    ["Packable Travel Scarf", 2900], ["Relaxed Jersey Lounge Set", 8500],
  ],
  footwear: [
    ["Canvas Low-Top Sneakers", 6900], ["Leather Walking Loafers", 11900],
    ["Trail Running Shoes", 13900], ["Everyday Slide Sandals", 3900],
    ["Waterproof Hiking Boots", 16900], ["Knit House Slippers", 3500],
    ["Minimal Court Sneakers", 7900], ["Cushioned Running Socks, 3-Pack", 1800],
    ["Leather Ankle Boots", 14900], ["Adjustable Sport Sandals", 6200],
  ],
  "kitchen-dining": [
    ["Stainless Steel Saucepan", 7900], ["Acacia Serving Board", 3200],
    ["Glass Food Storage Set", 4500], ["Manual Burr Coffee Grinder", 8900],
    ["Stoneware Dinner Plate Set", 6900], ["Digital Kitchen Scale", 2800],
    ["Silicone Baking Mat Pair", 1700], ["Enamel Pour-Over Kettle", 6400],
    ["Cotton Kitchen Towel Set", 1900], ["Stackable Spice Jar Set", 3400],
  ],
  "beauty-personal-care": [
    ["Gentle Facial Cleansing Brush", 2900], ["Reusable Makeup Pad Set", 1500],
    ["Wide-Tooth Acetate Comb", 1800], ["Travel Skincare Bottle Kit", 1200],
    ["Soft Cotton Face Cloth Set", 1700], ["Rechargeable Facial Massager", 4900],
    ["Bamboo Hair Brush", 2100], ["Insulated Cosmetic Bag", 2600],
    ["Stainless Manicure Tool Set", 2400], ["Padded Cotton Eye Mask", 1900],
  ],
  "sports-fitness": [
    ["Compact Dumbbell Set", 12900], ["Resistance Band Set", 2600],
    ["Balance Training Board", 5900], ["Jump Rope with Bearing Handles", 2200],
    ["Textured Recovery Roller", 3100], ["Adjustable Kettlebell", 15900],
    ["Running Waist Pack", 2400], ["Foldable Exercise Mat", 4900],
    ["Doorway Pull-Up Bar", 5200], ["Cycling Repair Kit", 2800],
  ],
  "books-stationery": [
    ["Dotted Hardcover Notebook", 1800], ["Fountain Pen Starter Set", 3900],
    ["Undated Weekly Planner", 2400], ["Watercolor Sketch Pad", 1600],
    ["Desk Letter Tray", 2200], ["Fine-Line Drawing Pen Set", 2100],
    ["Bookbinding Journal Kit", 3500], ["Reusable Study Flashcards", 1200],
    ["Compact Reading Stand", 2900], ["Archival Document Folder Set", 1700],
  ],
  "toys-games": [
    ["Wooden Block Building Set", 3900], ["Cooperative Word Board Game", 4500],
    ["1000-Piece Botanical Puzzle", 2800], ["Magnetic Drawing Board", 2400],
    ["Wooden Marble Run Kit", 5900], ["Portable Chess Set", 3200],
    ["Silicone Stacking Toy", 1900], ["Family Trivia Card Deck", 1600],
    ["Beginner Origami Paper Set", 1300], ["Dominoes in Storage Tin", 2100],
  ],
  "grocery-essentials": [
    ["Single-Origin Ground Coffee", 1600], ["Loose-Leaf Breakfast Tea Tin", 1400],
    ["Cold-Pressed Sesame Oil", 1900], ["Wholegrain Rolled Oats", 900],
    ["Dried Mango Snack Pack", 1100], ["Raw Forest Honey Jar", 1800],
    ["Smoked Paprika Seasoning", 700], ["Dark Chocolate Baking Bar", 1200],
    ["Mixed Lentil Pantry Pack", 1000], ["Cold-Pressed Olive Oil", 2500],
  ],
};

const categoryMap = new Map(seedCategories.map((category) => [category.slug, category]));
const dataDir = join(process.cwd(), "data");
const artDir = join(process.cwd(), "public", "products", "phase2");
mkdirSync(dataDir, { recursive: true });
mkdirSync(artDir, { recursive: true });

function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const prepared = [];
for (const category of seedCategories) {
  const products = entries[category.slug];
  if (!products || products.length !== 10) throw new Error(`Expected 10 drafts for ${category.slug}.`);
  products.forEach(([name, priceInCents], index) => {
    const slug = slugify(name);
    const sku = `SS-P2-${category.slug.toUpperCase().replaceAll("-", "").slice(0, 8)}-${String(index + 1).padStart(3, "0")}`;
    const imagePath = `/products/phase2/${slug}.svg`;
    const item = {
      name,
      slug,
      sku,
      summary: `${name} for practical, everyday use in the ${category.name.toLowerCase()} collection.`,
      description: `${name} is a straightforward ${category.name.toLowerCase()} item selected for regular home and personal use. Its design focuses on clear function, easy storage, and a simple routine. Confirm supplier specifications, materials, and local compliance before offering it for sale.`,
      highlights: ["Everyday-use design", "Simple to store and maintain", "Supplier specifications require confirmation"],
      tags: [category.slug, "phase-2-draft"],
      priceInCents,
      compareAtPriceInCents: null,
      categorySlug: category.slug,
      images: [imagePath],
      stock: 0,
      badge: null,
      featured: false,
      active: false,
    };
    prepared.push(item);
  });
}

const sourceKeys = new Set(seedProducts.flatMap((product) => [
  `name:${product.name.normalize("NFKC").trim().toLowerCase()}`,
  `slug:${product.slug.toLowerCase()}`,
  `sku:${product.sku.toLowerCase()}`,
]));
const seen = new Set();
const duplicateErrors = [];
for (const product of prepared) {
  for (const key of [`name:${product.name.normalize("NFKC").trim().toLowerCase()}`, `slug:${product.slug}`, `sku:${product.sku.toLowerCase()}`]) {
    if (sourceKeys.has(key) || seen.has(key)) duplicateErrors.push(`Duplicate catalog key: ${key}`);
    seen.add(key);
  }
  if (!categoryMap.has(product.categorySlug)) throw new Error(`Unknown category ${product.categorySlug}`);
}
if (duplicateErrors.length) throw new Error(duplicateErrors.join("\n"));

for (const [index, product] of prepared.entries()) {
  const category = categoryMap.get(product.categorySlug);
  const paletteHue = (index * 31 + product.categorySlug.length * 17) % 360;
  writeFileSync(join(artDir, `${product.slug}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="Illustration placeholder for ${escapeXml(product.name)}"><rect width="800" height="600" fill="hsl(${paletteHue} 35% 94%)"/><circle cx="570" cy="205" r="125" fill="hsl(${paletteHue} 48% 80%)"/><path d="M0 480 Q200 400 400 480 T800 450 V600 H0Z" fill="hsl(${paletteHue} 32% 84%)"/><text x="56" y="88" font-family="Arial,sans-serif" font-size="18" letter-spacing="3" fill="#3f3f46">${escapeXml(category.name.toUpperCase())}</text><text x="56" y="390" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="#27272a">${escapeXml(product.name)}</text><text x="56" y="440" font-family="Arial,sans-serif" font-size="16" fill="#52525b">CATALOG ILLUSTRATION · PRODUCT PHOTO NOT VERIFIED</text></svg>\n`, "utf8");
}

writeFileSync(join(dataDir, "catalog-phase2-products.json"), `${JSON.stringify({
  format: "shopsphere-phase2-catalog-draft-v1",
  baseline: { sourceProducts: seedProducts.length, targetTotal: 250, liveDatabaseCount: null },
  categories: seedCategories.map(({ slug, name }) => ({ slug, name })),
  products: prepared,
  artwork: { type: "generated-illustration", note: "Illustrations are placeholders, not verified product photography." },
  productFacts: { verified: false, note: "Confirm supplier specifications, product facts, prices, and availability before activation." },
}, null, 2)}\n`, "utf8");
console.log(`Prepared ${prepared.length} drafts across ${seedCategories.length} source categories. Source-based total: ${seedProducts.length + prepared.length}; live database count: unknown.`);
