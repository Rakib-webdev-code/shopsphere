"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type SectionNavLink = {
  href: string;
  label: string;
  exact?: boolean;
  emphasis?: boolean;
};

type SectionNavProps = {
  links: readonly SectionNavLink[];
  ariaLabel: string;
  variant?: "sidebar" | "pills";
  className?: string;
};

function linkIsActive(
  pathname: string,
  link: SectionNavLink,
) {
  return link.exact
    ? pathname === link.href
    : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function SectionNav({
  links,
  ariaLabel,
  variant = "pills",
  className = "",
}: SectionNavProps) {
  const pathname = usePathname();

  if (variant === "sidebar") {
    return (
      <nav aria-label={ariaLabel} className={className}>
        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {links.map((link) => {
            const active = linkIsActive(pathname, link);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                    active
                      ? "bg-surface font-semibold text-foreground shadow-sm ring-1 ring-border"
                      : link.emphasis
                        ? "font-semibold text-accent hover:bg-surface hover:text-accent-strong"
                        : "font-medium text-muted-strong hover:bg-surface hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }

  return (
    <nav
      aria-label={ariaLabel}
      className={`overflow-x-auto ${className}`}
    >
      <ul className="flex min-w-max gap-2">
        {links.map((link) => {
          const active = linkIsActive(pathname, link);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                  active
                    ? "border-accent-border bg-accent-soft text-accent-strong"
                    : "border-border bg-surface text-muted-strong hover:border-accent-border hover:bg-accent-soft hover:text-accent-strong"
                }`}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
