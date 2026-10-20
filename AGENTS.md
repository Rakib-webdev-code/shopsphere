<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ShopSphere Agent Notes

## Working style

- The owner is learning the stack. When asked for guidance, explain and let them implement; edit files only when explicitly asked to implement.
- Do not install packages unless explicitly requested.

## Repo shape and commands

- Next.js 16.4.2 App Router, React 19.3, strict TypeScript, Tailwind CSS v4. Use npm (`package-lock.json` is the only lockfile).
- Routes live in `src/app`; auth code lives in `src/lib`. The `@/*` alias maps to `src/*`.
- `README.md` is default create-next-app boilerplate and still says `app/page.tsx`; the real path is `src/app/page.tsx`. Trust the config and scripts over the README.
- No test suite, CI workflows, or pre-commit hooks are configured.
- Verify changes with `npm run lint`, `npx tsc --noEmit` (there is no `typecheck` script), and `npm run build`.
- `npm run dev` starts the dev server; `npm start` serves a production build.
- The build route table is the source of truth for whether a route is actually registered.

## Next.js 16 / Cache Components

- `next.config.ts` enables `cacheComponents` and `partialPrefetching`, so App Router pages use partial prerendering.
- Prerendered output must be deterministic. `new Date()`, `Date.now()`, `Math.random()`, and `crypto.randomUUID()` cause blocking-prerender build errors. Use a static value, cache the result, or defer the read behind `<Suspense>` with `io()`/`connection()`. Client Components are SSR-prerendered too.
- Under Cache Components, do not use the removed `dynamic`, `revalidate`, `fetchCache`, or `runtime` route config. `force-dynamic` is not the fix for prerender errors.
- Use the generated `PageProps<"/path">` and `LayoutProps<"/path">` types; `params` and `searchParams` are async.

## Styling

- Tailwind v4 is compiled by the `@tailwindcss/turbopack` loader in `next.config.ts`. There is no PostCSS config or `tailwind.config.*`; theme tokens belong in `src/app/globals.css` (`@theme`).
- Visual direction: white, charcoal (`zinc-900`/`zinc-600`), and emerald (`emerald-600`/`emerald-700`). The homepage hardcodes the light palette.
- `src/app/globals.css` still switches tokens under `prefers-color-scheme: dark` and sets `body` to Arial despite the Geist variables in `layout.tsx`. Do not assume dark mode or Geist styling is finished.

## Auth and data

- Better Auth 1.7.11 + `@better-auth/mongo-adapter`. Server config is `src/lib/auth.ts`, the client is `src/lib/auth-client.ts`, and the handler is `src/app/api/auth/[...all]/route.ts`.
- Env names: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `MONGODB_URI`, `MONGODB_DB` (optional), `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`/`FACEBOOK_CLIENT_SECRET`, and `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET`. A social provider is enabled only when both of its values are present.
- MongoDB uses `MONGODB_DB` when set, otherwise `shopsphere`. The adapter uses `transaction: false` because a local standalone MongoDB does not support transactions.
- Auth pages live in `src/app/sign-in` and `src/app/sign-up`; the shared client form is `src/components/auth-form.tsx`.
- OAuth callback paths are `/api/auth/callback/{google,facebook,github}` and must be registered in each provider dashboard.
