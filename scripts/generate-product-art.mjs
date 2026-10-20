/**
 * Explicit development utility for the sample catalog art.
 *
 * It only creates artwork for seed products that do not already have it.
 * The original twelve hand-made product SVGs are never overwritten, and this
 * script is not run by `npm run db:seed` or by the application at startup.
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedCategories, seedProducts } from "./seed-data.mjs";

const outputDir = join(process.cwd(), "public", "products");
const force = process.argv.includes("--force");

const palettes = {
  audio: ["#ecfdf5", "#99f6e4", "#0f766e"],
  workspace: ["#fafafa", "#e4e4e7", "#3f3f46"],
  home: ["#fefce8", "#d9f99d", "#4d7c0f"],
  accessories: ["#f0fdfa", "#bae6fd", "#0e7490"],
  outdoor: ["#ecfeff", "#bbf7d0", "#047857"],
  wellness: ["#f0fdf4", "#fef3c7", "#3f6212"],
  electronics: ["#eff6ff", "#cffafe", "#1d4ed8"],
  fashion: ["#fff7ed", "#fde68a", "#9a3412"],
  footwear: ["#f5f5f4", "#d6d3d1", "#44403c"],
  "kitchen-dining": ["#fffbeb", "#fed7aa", "#b45309"],
  "beauty-personal-care": ["#fdf2f8", "#fbcfe8", "#be185d"],
  "sports-fitness": ["#f0fdfa", "#99f6e4", "#0f766e"],
  "books-stationery": ["#fefce8", "#e7e5e4", "#57534e"],
  "toys-games": ["#fef2f2", "#fecaca", "#b91c1c"],
  "grocery-essentials": ["#f7fee7", "#fde68a", "#4d7c0f"],
};

const glyphs = {
  headphones: `
    <path d="M13 35v-3a19 19 0 0 1 38 0v3" />
    <rect x="9" y="33" width="10" height="18" rx="5" />
    <rect x="45" y="33" width="10" height="18" rx="5" />`,
  speaker: `
    <rect x="18" y="9" width="28" height="46" rx="7" />
    <circle cx="32" cy="38" r="8" />
    <circle cx="32" cy="22" r="2" />
    <path d="M25 14h14" />`,
  lamp: `
    <path d="M22 14h20l8 18H14l8-18Z" />
    <path d="M32 32v18" />
    <path d="M22 53h20" />
    <path d="M28 14v-2h8v2" />`,
  keyboard: `
    <rect x="8" y="21" width="48" height="25" rx="5" />
    <path d="M16 29h3M24 29h3M32 29h3M40 29h3M48 29h1M16 37h3M24 37h3M32 37h3M40 37h3M48 37h1M23 45h18" />`,
  mug: `
    <path d="M17 19h25v27a6 6 0 0 1-6 6H23a6 6 0 0 1-6-6V19Z" />
    <path d="M42 25h5a7 7 0 0 1 0 14h-5" />
    <path d="M24 11v4M33 8v7" />`,
  throw: `
    <path d="M14 17h36v30H14z" />
    <path d="M14 27h36M14 37h36M27 17v30" />
    <path d="M18 47v4M46 47v4" />`,
  backpack: `
    <path d="M20 24a12 12 0 0 1 24 0v27H20V24Z" />
    <path d="M26 24v-4a6 6 0 0 1 12 0v4" />
    <path d="M20 38h24" />
    <path d="M27 44h10" />
    <path d="M20 30h4M40 30h4" />`,
  watch: `
    <circle cx="32" cy="32" r="13" />
    <path d="m26 20 1-10h10l1 10" />
    <path d="m26 44 1 10h10l1-10" />
    <path d="M32 25v8l5 3" />`,
  sneaker: `
    <path d="M12 40c8-2 13-6 18-14l4 4c3 5 8 7 16 8 3 0 5 2 5 5v4H12v-7Z" />
    <path d="M12 45h43" />
    <path d="m25 34 4 4M32 30l4 4" />`,
  bottle: `
    <path d="M25 10h14v8l3 5v25a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V23l3-5v-8Z" />
    <path d="M25 18h14" />
    <path d="M32 29v15" />
    <path d="M27 12h10" />`,
  diffuser: `
    <path d="M21 29h22l3 24H18l3-24Z" />
    <path d="M27 29v-6a5 5 0 0 1 10 0v6" />
    <path d="M31 16c0-4 4-5 4-8M39 15c0-3 3-4 3-6" />
    <path d="M26 38h12" />`,
  "yoga-mat": `
    <rect x="10" y="24" width="40" height="18" rx="9" />
    <circle cx="45" cy="33" r="9" />
    <path d="M45 24v18" />
    <path d="M19 33h17" />`,
};

const categoryBySlug = new Map(
  seedCategories.map((category) => [category.slug, category]),
);

function hash(value) {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0;
  }
  return result;
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function wrapName(name, maxLength = 19) {
  const words = name.split(" ");
  const lines = [];
  let line = "";

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;

    if (next.length > maxLength && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) {
    lines.push(line);
  }

  return lines.slice(0, 3);
}

function buildArtwork(product, category) {
  const palette = palettes[category.slug] ?? palettes.home;
  const [light, mid, ink] = palette;
  const glyph = glyphs[category.icon] ?? glyphs.backpack;
  const variant = hash(product.slug);
  const circleX = 610 + (variant % 60);
  const circleY = 100 + (variant % 70);
  const circleR = 130 + (variant % 50);
  const angle = -12 + (variant % 25);
  const lines = wrapName(product.name);
  const firstLineY = lines.length >= 3 ? 420 : lines.length === 2 ? 452 : 484;

  const nameLines = lines
    .map(
      (line, index) =>
        `<text x="70" y="${firstLineY + index * 50}" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="${ink}">${escapeXml(line)}</text>`,
    )
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" role="img" aria-label="${escapeXml(product.name)} illustration">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${light}"/>
      <stop offset="1" stop-color="${mid}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="${circleX}" cy="${circleY}" r="${circleR}" fill="#ffffff" opacity=".34"/>
  <path d="M-40 500C150 430 320 560 520 490s250-40 330-90" fill="none" stroke="#ffffff" stroke-width="26" opacity=".22"/>
  <g transform="translate(485 150) rotate(${angle}) scale(4)" fill="none" stroke="${ink}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".9">
    ${glyph.trim()}
  </g>
  <text x="70" y="88" font-family="Arial, Helvetica, sans-serif" font-size="17" font-weight="700" letter-spacing="3.5" fill="${ink}" opacity=".72">${escapeXml(category.name.toUpperCase())}</text>
  <line x1="70" y1="345" x2="730" y2="345" stroke="${ink}" stroke-width="2" opacity=".22"/>
  ${nameLines}
  <text x="70" y="562" font-family="Arial, Helvetica, sans-serif" font-size="14" letter-spacing="2.5" fill="${ink}" opacity=".55">SHOPSPHERE SAMPLE COLLECTION</text>
</svg>
`;
}

let created = 0;
let skipped = 0;

for (const product of seedProducts) {
  if (product.legacy) {
    skipped += 1;
    continue;
  }

  const category = categoryBySlug.get(product.categorySlug);

  if (!category) {
    throw new Error(`Unknown category ${product.categorySlug} for ${product.slug}.`);
  }

  const filePath = join(outputDir, `${product.slug}.svg`);

  if (existsSync(filePath) && !force) {
    console.log(`Kept existing artwork: ${product.slug}.svg`);
    skipped += 1;
    continue;
  }

  writeFileSync(filePath, buildArtwork(product, category), "utf8");
  created += 1;
}

console.log(
  `Product artwork ready: ${created} created, ${skipped} left untouched.`,
);
