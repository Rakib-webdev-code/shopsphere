import type { ReactNode } from "react";
import { StorefrontFooter } from "@/components/storefront-footer";
import { StorefrontHeader } from "@/components/storefront-header";

type StorefrontShellProps = {
  children: ReactNode;
};

export function StorefrontShell({ children }: StorefrontShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <StorefrontHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <StorefrontFooter />
    </div>
  );
}
