# ShopSphere

A full-stack storefront built with Next.js App Router, React, TypeScript, Tailwind CSS, MongoDB, and Better Auth. It keeps the original white / zinc / emerald visual direction while adding a live catalog, customer accounts, persistent cart and wishlist, server-validated checkout, reviews, coupons, and a protected admin dashboard.

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
- Orders are created as `unpaid`; no card data is collected and no fake payment success is shown

### Admin

- Dashboard with catalog, order, customer, revenue, and low-stock summaries
- Product create / edit / soft-deactivate and direct stock updates
- Category create / edit / soft-deactivate
- Inventory view with a low-stock filter
- Order search and allowed status transitions
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
```

MongoDB uses `MONGODB_DB` when set, otherwise `shopsphere`. The existing `user`, `account`, `session`, and `verification` collections are used as-is; the app never resets them.

For stock-safe checkout with MongoDB transactions, connect to a replica set. The order service detects transaction support and uses compensating updates on standalone MongoDB.

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

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build and route type checks |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Strict TypeScript check |
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
src/lib/auth/            Server session and role checks
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

Indexes are defined in `src/lib/db/collections.ts` and mirrored by `scripts/db-utils.mjs` for explicit initialization.

## Verification

```bash
npx tsc --noEmit
npm run lint
npm run build
```

There is no test suite or CI configuration in this repository. The checkout flow is intentionally not connected to a payment provider; an order is `unpaid` until a real payment integration is added.

## Notes

- The app uses Cache Components. Request-time database and session reads call `connection()` and pages wrap streamed content in `<Suspense>`.
- `src/app/globals.css` still contains inherited dark-mode token overrides from the starter. The current visual direction is the light white / zinc / emerald storefront.
- Better Auth email verification logs a development-only link to the server console. Configure a real mail provider before production use.
