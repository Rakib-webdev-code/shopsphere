import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { socialProviderAvailability } from "@/lib/auth-providers";

export const metadata: Metadata = {
  title: "Sign in | ShopSphere",
  description: "Sign in to your ShopSphere account.",
};

export default function SignInPage() {
  return (
    <AuthShell>
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          Welcome back
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Sign in to ShopSphere
        </h1>
        <p className="mt-2 text-sm text-muted">
          Access your account, orders, and saved items.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <AuthForm
          mode="sign-in"
          enabledProviders={socialProviderAvailability}
        />
      </div>
    </AuthShell>
  );
}
