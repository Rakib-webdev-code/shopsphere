"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  desktopNavLinks,
  isActivePath,
} from "@/components/storefront-navigation";

const navItemClass =
  "inline-flex rounded-full px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

function HeaderNavLinks() {
  const pathname = usePathname();

  return (
    <>
      {desktopNavLinks.map((link) => {
        const active = isActivePath(pathname, link.href);

        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`${navItemClass} ${
                active
                  ? "bg-surface-muted text-foreground"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </>
  );
}

export function HeaderNav() {
  return (
    <nav aria-label="Main navigation" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        <Suspense
          fallback={desktopNavLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`${navItemClass} text-muted hover:bg-surface-muted hover:text-foreground`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        >
          <HeaderNavLinks />
        </Suspense>
      </ul>
    </nav>
  );
}
