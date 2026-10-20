import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="shrink-0 text-xl font-bold tracking-tight text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Shop<span className="text-accent-bright">Sphere</span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/"
              className="hidden text-sm font-medium text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:inline-flex"
            >
              Back to store
            </Link>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden bg-linear-to-b from-accent-soft/50 via-background to-background px-4 py-12 sm:px-6">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden"
        >
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-bright/10 blur-3xl" />
          <div className="absolute -bottom-32 left-1/4 h-72 w-72 rounded-full bg-accent-bright/5 blur-3xl" />
        </div>

        <div className="relative z-10 w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
