import Link from "next/link";
import { AccountMenu } from "@/components/account-menu";
import { HeaderNav } from "@/components/header-nav";
import { CartIcon, HeartIcon } from "@/components/icons";
import { MobileMenu } from "@/components/mobile-menu";
import { StorefrontSearch } from "@/components/storefront-search";
import { ThemeToggle } from "@/components/theme-toggle";
import { iconButtonClass } from "@/components/ui";

export function StorefrontHeader() {
  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-accent-solid focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 py-3.5">
            <Link
              href="/"
              className="shrink-0 text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Shop<span className="text-accent-bright">Sphere</span>
            </Link>

            <HeaderNav />

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="hidden w-48 md:block xl:w-64">
                <StorefrontSearch />
              </div>

              <ThemeToggle />

              <AccountMenu />

              <Link
                href="/wishlist"
                aria-label="View wishlist"
                className={`hidden sm:inline-flex ${iconButtonClass}`}
              >
                <HeartIcon className="h-5 w-5" />
              </Link>

              <Link
                href="/cart"
                aria-label="View cart"
                className={`inline-flex ${iconButtonClass}`}
              >
                <CartIcon />
              </Link>

              <MobileMenu />
            </div>
          </div>

          <div className="pb-3 md:hidden">
            <StorefrontSearch />
          </div>
        </div>
      </header>
    </>
  );
}
