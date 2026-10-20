"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ArrowRightIcon, MenuIcon, XIcon } from "@/components/icons";
import {
  isActivePath,
  mobileNavLinks,
} from "@/components/storefront-navigation";
import { ThemeToggle } from "@/components/theme-toggle";

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [activePath, setActivePath] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function handlePopState() {
      setOpen(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trigger = triggerRef.current;
    const desktopQuery = window.matchMedia("(min-width: 1024px)");
    const handleDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setOpen(false);
      }
    };
    desktopQuery.addEventListener("change", handleDesktop);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const panel = panelRef.current;
      if (!panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (!panel.contains(activeElement)) {
        event.preventDefault();
        first.focus();
        return;
      }

      if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      desktopQuery.removeEventListener("change", handleDesktop);
      document.body.style.overflow = previousOverflow;
      trigger?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setActivePath(window.location.pathname);
          setOpen(true);
        }}
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-menu-panel"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-strong transition-colors hover:border-border-strong hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 lg:hidden"
      >
        <MenuIcon />
      </button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[70] lg:hidden">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="absolute inset-0 h-full w-full cursor-default bg-zinc-950/50 backdrop-blur-sm"
              />

              <div
                ref={panelRef}
                id="mobile-menu-panel"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mobile-menu-title"
                className="absolute inset-y-0 right-0 flex w-full max-w-sm flex-col border-l border-border bg-surface shadow-2xl"
              >
                <h2 id="mobile-menu-title" className="sr-only">
                  Site menu
                </h2>

                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <Link
                    href="/"
                    onClick={() => setOpen(false)}
                    className="text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    Shop<span className="text-accent-bright">Sphere</span>
                  </Link>
                  <button
                    ref={closeRef}
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Close menu"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface text-muted-strong transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <XIcon />
                  </button>
                </div>

                <nav
                  aria-label="Mobile navigation"
                  className="flex-1 overflow-y-auto px-3 py-4"
                >
                  <ul className="space-y-1">
                    {mobileNavLinks.map((link) => {
                      const active = isActivePath(activePath, link.href);

                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            onClick={() => setOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
                              active
                                ? "bg-surface-muted text-foreground"
                                : "text-muted hover:bg-surface-muted hover:text-foreground"
                            }`}
                          >
                            {link.label}
                            <ArrowRightIcon className="h-4 w-4 text-muted-soft" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-6 border-t border-border pt-5">
                    <p className="px-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-soft">
                      Appearance
                    </p>
                    <div className="mt-3 px-4">
                      <ThemeToggle />
                    </div>
                  </div>
                </nav>

                <div className="border-t border-border px-5 py-4">
                  <p className="text-xs leading-5 text-muted-soft">
                    Secure account-based cart and server-validated checkout.
                  </p>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
