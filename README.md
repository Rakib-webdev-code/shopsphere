# ShopSphere

A full-stack storefront built with Next.js App Router, React, TypeScript, Tailwind CSS, MongoDB, and Better Auth. It keeps the original white / zinc / emerald visual direction while adding a live catalog, customer accounts, persistent cart and wishlist, server-validated checkout, reviews, coupons, a protected admin dashboard, and a catalog-grounded shopping assistant.

## Stack

- Next.js 16.4 App Router with Cache Components and Partial Prerendering
- React 19 and strict TypeScript
- Tailwind CSS v4 (compiled by the Turbopack loader; theme tokens live in `src/app/globals.css`)
- MongoDB with the official Node driver
- Better Auth with the MongoDB adapter
- npm and `package-lock.json`

## Features

### Storefront

- MongoDB-backed products and categories
- Search, category filters, price filters, sorting, and pagination
- Product detail pages with gallery, stock state, related products, and reviews
- Local SVG product artwork with generated fallbacks
- Shopping assistant at `/assistant` with plain-language search, budget parsing, comparisons, gift suggestions, and alternatives
- Loading skeletons, empty states, error states, and `noindex` on private pages

### Accounts

- Email/password and configured social sign-in through Better Auth
- Profile editing, saved addresses, and default-address selection
- Persistent cart and wishlist
- Order history and order detail with status and totals
- Authorized review create / edit / delete with real rating aggregation
- Verified-purchase badge when the customer has a delivered order for the product

### Checkout

- Server-side prices, stock checks, coupon validation, discount, shipping, and totals
- Stock reservation with conditional updates; concurrent orders cannot oversell
- MongoDB transactions when the deployment supports them, with compensating logic for standalone deployments
- Coupon usage limits enforced with conditional updates
- Checkout requires a per-user idempotency key and the matching unique index; standalone recovery fences each product and coupon effect so a late worker cannot reserve after release
- Category deactivation is blocked while a checkout holds that category's eligibility lock
- Orders are created as `unpaid`; no card data is collected and no fake payment success is shown

### Admin

- Dashboard with catalog, order, customer, revenue, and low-stock summaries
- Product create / edit / soft-deactivate; edits cannot overwrite live stock
- Category create / edit / soft-deactivate
- Inventory view with a low-stock filter and transactional, stale-checked stock adjustments with a durable audit trail
- Order search and allowed status transitions
- Inventory recovery panel for orders that need reconciliation, with a safe retry and an audited, two-step force-release
- Customer overview with order counts and spend
- Coupon create / edit / soft-deactivate
- Every admin page and admin API route requires an admin role read from MongoDB on the server

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create `.env` (or `.env.local`) and provide these names. Do not commit secret values.

```dotenv
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=http://localhost:3000
MONGODB_URI=
MONGODB_DB=shopsphere

# Optional providers. A provider is enabled only when both values are present.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
FACEBOOK_CLIENT_ID=
FACEBOOK_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# Optional shopping-assistant provider. Without these, the assistant runs in
# deterministic catalog-only mode. See "Shopping Assistant" below.
AI_ASSISTANT_API_KEY=
AI_ASSISTANT_MODEL=
AI_ASSISTANT_BASE_URL=
```

MongoDB uses `MONGODB_DB` when set, otherwise `shopsphere`. The existing `user`, `account`, `session`, and `verification` collections are used as-is; the app never resets them.

For stock-safe checkout with MongoDB transactions, connect to a replica set. The order service detects transaction support and uses compensating updates on standalone MongoDB.

Manual stock adjustments and product creation with initial stock require transactions. On a deployment without transaction support they fail closed with `503 TRANSACTIONS_UNAVAILABLE` instead of applying an unaudited stock change. Zero-stock product creation does not need a transaction.

OAuth callback paths:

- `/api/auth/callback/google`
- `/api/auth/callback/facebook`
- `/api/auth/callback/github`

Register the matching path in each provider dashboard.

### 3. Create indexes

```bash
npm run db:init
```

This is repeat-safe. It creates indexes on catalog, cart, wishlist, address, order, review, coupon, and user-role fields without deleting or resetting documents.

Run this as an explicit operator action against the intended deployment database before enabling checkout. Checkout fails closed if its unique `(userId, checkoutKey)` index is absent. Never point this command at production until the database target and maintenance plan have been reviewed.

### 4. Add sample data (optional)

```bash
npm run db:seed
```

The seed uses upserts with `$setOnInsert`, so running it again inserts nothing and leaves existing products, stock, coupons, users, and orders untouched. It adds fifteen categories, 100 sample products, and three sample coupons. Product images are local SVGs in `public/products/`.

Sample records are marked with a `seedKey` such as `shopsphere-sample-catalog-v1:product:halo-wireless-headphones`. The script matches records by that marker rather than by name or slug alone. The original six categories and twelve products, created before the marker existed, are adopted once by exact slug plus SKU/name matching; adoption only adds the marker field and never overwrites catalog data. If a slug already belongs to a document the seed does not own, that record is skipped and reported, not replaced.

Artwork for the newer sample products can be rebuilt with `node scripts/generate-product-art.mjs --force`. The script only touches generated SVGs; the original twelve hand-made product images are left alone.

### 5. Run the app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Production:

```bash
npm run build
npm start
```

## Creating the First Admin

Admin access is intentionally manual. Public sign-up always creates a `customer`; the Better Auth `role` field uses `input: false`, so it cannot be supplied by a public request.

1. Sign up normally at `/sign-up`.
2. From the project directory, run:

```bash
npm run admin:promote -- you@example.com
```

The script matches an existing Better Auth user by email (or by MongoDB ObjectId), sets `role` to `admin`, and never creates an account. It is idempotent. Sign out and back in if the UI link does not appear immediately; server authorization always re-reads the role from MongoDB.

Do not promote users automatically in seed data, sign-up, or deployment hooks.

## Shopping Assistant

`/assistant` accepts a plain-language request such as “find headphones under $200”, “suggest a gift for a student”, “compare two audio products”, or “show alternatives to this item”. The API endpoint is `POST /api/assistant`.

The assistant has two modes:

- **Catalog mode (default).** No external provider is called. The server parses the request, searches active products through the existing catalog service, applies budget and availability filters, and ranks the verified records deterministically. This mode is clearly labelled “Catalog match” in the UI.
- **AI-ranked mode (optional).** When `AI_ASSISTANT_API_KEY` and `AI_ASSISTANT_MODEL` are set, the server may send a bounded candidate list to an OpenAI-compatible chat-completions endpoint. `AI_ASSISTANT_BASE_URL` defaults to `https://api.openai.com/v1`. The provider may only return candidate IDs and a short reason; the server validates the IDs, rejects prices or stock quantities in the explanation, and hydrates names, prices, stock, categories, and links from MongoDB. Provider failures fall back to catalog mode with a visible notice.

Safety properties:

- The service is read-only: it never writes products, carts, orders, reviews, coupons, or inventory.
- Client-supplied prices, products, stock, or URLs are ignored.
- Inactive products and products in inactive categories are excluded.
- Unknown or fabricated product IDs from a provider are discarded.
- Requests are capped at 500 characters and 8 KB of JSON.
- The endpoint has a best-effort in-process limit of 20 requests per five minutes per signed-in user or client address. This protects a single instance only; a multi-instance deployment needs a shared store such as Redis. It is not an authorization control.
- The assistant cannot collect payment details or perform account, cart, or order actions.

Configure a provider only on the server. Never expose the key through a `NEXT_PUBLIC_*` variable. If no provider is configured, the assistant still works and is fully honest about being a catalog search rather than a live model.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build and route type checks |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Strict TypeScript check |
| `npm test` | Unit and integration tests (database tests use isolated throwaway databases) |
| `npm run test:http` | HTTP integration tests against an existing production build |
| `npm run db:init` | Create database indexes; never deletes data |
| `npm run db:seed` | Insert missing sample content with `$setOnInsert`; skips records it does not own |
| `npm run admin:promote -- <email-or-id>` | Manually grant the admin role to an existing user |

The database scripts load `.env` and `.env.local` with Node's `--env-file-if-exists` flags.

## Architecture

```text
src/app/                 Routes, pages, layouts, and API handlers
src/components/          Shared UI and client forms
src/lib/db/              MongoDB collections, document types, transactions
src/lib/services/        Business logic and data access
src/lib/assistant/       Pure intent parsing, ranking, and provider-output validation
src/lib/auth/            Server session and role checks
src/lib/rate-limit.ts    Best-effort in-process limiter for the assistant
src/lib/validation.ts    Request parsing and input validation
src/lib/api.ts           JSON responses and safe API error mapping
scripts/                 Explicit index, seed, and admin-provisioning scripts
```

Rules used throughout:

- Prices are integer cents. Dates are stored as `Date` and serialized as ISO strings.
- Server handlers calculate totals; client-submitted totals are ignored.
- Product, category, and coupon removal is a soft deactivation.
- Customers can only read and mutate their own cart, wishlist, addresses, orders, and reviews.
- Admin identity is checked from the session and then from MongoDB; a session cookie alone is not enough.
- Unknown database errors are logged server-side and returned as generic messages.
- Private account, checkout, admin, and API responses are not cached as public content.
- Assistant product facts always come from the catalog service or MongoDB, never from a language model.

## MongoDB Collections

`user`, `account`, `session`, `verification` (Better Auth), plus:

- `categories`
- `products`
- `carts`
- `wishlists`
- `addresses`
- `orders`
- `reviews`
- `coupons`
- `inventoryAdjustments` (append-only stock audit records)

Indexes are defined in `src/lib/db/collections.ts` and mirrored by `scripts/db-utils.mjs` for explicit initialization.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run test:http
```

Test scripts do not load `.env` or `.env.local`. To run database suites, set `MONGODB_URI` explicitly in the test process to a MongoDB instance reserved for testing. Each suite selects a fresh `ss_phase1_test_*` database, verifies the effective database name before database operations, and checks that exact name again before dropping it. Without an explicit URI, database suites skip. `npm run test:http` additionally requires a production build (`.next/BUILD_ID`) and uses its own isolated test database.

The checkout flow is intentionally not connected to a payment provider; an order is `unpaid` until a real payment integration is added.

Assistant tests cover budget and intent parsing, ranking, empty results, malformed provider output, fabricated IDs, rejected price or stock claims in provider reasons, and the rate limiter. These are pure tests and run without MongoDB. A configured external AI provider was not exercised during repository verification because no provider credentials were available; catalog mode is the verified default. No test calls a paid provider.

## Notes

- The app uses Cache Components. Request-time database and session reads call `connection()` and pages wrap streamed content in `<Suspense>`.
- `src/app/globals.css` still contains inherited dark-mode token overrides from the starter. The current visual direction is the light white / zinc / emerald storefront.
- Better Auth email verification logs a development-only link to the server console. Configure a real mail provider before production use.
