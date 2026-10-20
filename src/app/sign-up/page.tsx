import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { socialProviderAvailability } from "@/lib/auth-providers";

export const metadata: Metadata = {
  title: "Create account | ShopSphere",
  description: "Create a ShopSphere account.",
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent">
          Join ShopSphere
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Save your details and keep track of your orders.
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:p-8">
        <AuthForm
          mode="sign-up"
          enabledProviders={socialProviderAvailability}
        />
      </div>
    </AuthShell>
  );
}
