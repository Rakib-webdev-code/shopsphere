import Link from "next/link";

const shopLinks = [
  { href: "/shop", label: "All products" },
  { href: "/shop?sort=newest", label: "New arrivals" },
  { href: "/categories", label: "Categories" },
  { href: "/about", label: "About ShopSphere" },
] as const;

const accountLinks = [
  { href: "/account", label: "Your account" },
  { href: "/account/orders", label: "Order history" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/cart", label: "Cart" },
] as const;

const footerLinkClassName =
  "text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

export function StorefrontFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              className="text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Shop<span className="text-accent-bright">Sphere</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-6 text-muted">
              Considered everyday essentials for home, work, and everywhere in
              between.
            </p>
            <p className="mt-4 inline-flex items-center gap-2 text-xs leading-5 text-muted-soft">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-accent-bright"
              />
              Secure accounts, a persistent cart, and server-validated checkout.
            </p>
          </div>

          <nav aria-labelledby="footer-shop-heading">
            <h2
              id="footer-shop-heading"
              className="text-sm font-semibold text-foreground"
            >
              Shop
            </h2>
            <ul className="mt-4 space-y-3">
              {shopLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-account-heading">
            <h2
              id="footer-account-heading"
              className="text-sm font-semibold text-foreground"
            >
              Account
            </h2>
            <ul className="mt-4 space-y-3">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={footerLinkClassName}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-labelledby="footer-start-heading">
            <h2
              id="footer-start-heading"
              className="text-sm font-semibold text-foreground"
            >
              Get started
            </h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link href="/sign-in" className={footerLinkClassName}>
                  Sign in
                </Link>
              </li>
              <li>
                <Link href="/sign-up" className={footerLinkClassName}>
                  Create an account
                </Link>
              </li>
              <li>
                <Link href="/cart" className={footerLinkClassName}>
                  View cart
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-muted-soft sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>&copy; 2026 ShopSphere.</p>
          <p>Built with Next.js, TypeScript, MongoDB, and Tailwind CSS.</p>
        </div>
      </div>
    </footer>
  );
}
