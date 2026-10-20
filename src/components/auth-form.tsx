"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui";
import { signIn, signUp } from "@/lib/auth-client";

type AuthMode = "sign-in" | "sign-up";
type SocialProvider = "google" | "facebook" | "github";

const providers: { id: SocialProvider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "facebook", label: "Facebook" },
];

type AuthFormProps = {
  mode: AuthMode;
  enabledProviders: Record<SocialProvider, boolean>;
};

export function AuthForm({ mode, enabledProviders }: AuthFormProps) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingProvider, setPendingProvider] =
    useState<SocialProvider | null>(null);

  const isBusy = isSubmitting || pendingProvider !== null;

  function safeNextPath() {
    if (typeof window === "undefined") {
      return "/";
    }

    const next = new URLSearchParams(window.location.search).get("next");

    if (!next || !next.startsWith("/") || next.startsWith("//")) {
      return "/";
    }

    return next;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const next = safeNextPath();

    try {
      const result = isSignUp
        ? await signUp.email({ name, email, password, callbackURL: next })
        : await signIn.email({ email, password, callbackURL: next });

      if (result.error) {
        setError(
          result.error.message ?? "Authentication failed. Please try again.",
        );
        return;
      }

      router.push(next);
      router.refresh();
    } catch {
      setError("Unable to reach the authentication server. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSocialSignIn(provider: SocialProvider) {
    setError(null);
    setPendingProvider(provider);
    const next = safeNextPath();

    try {
      const result = await signIn.social({
        provider,
        callbackURL: next,
        errorCallbackURL: isSignUp
          ? `/sign-up?next=${encodeURIComponent(next)}`
          : `/sign-in?next=${encodeURIComponent(next)}`,
      });

      if (result.error) {
        setError(
          result.error.message ?? `Unable to continue with ${provider}.`,
        );
      }
    } catch {
      setError("Unable to start social sign in. Please try again.");
    } finally {
      setPendingProvider(null);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div>
            <label
              htmlFor="name"
              className={labelClass}
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isBusy}
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className={labelClass}
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isBusy}
            className={inputClass}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className={labelClass}
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isBusy}
            className={inputClass}
          />
          {isSignUp && (
            <p className="mt-1.5 text-xs text-muted-soft">
              Use at least 8 characters.
            </p>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className={`${primaryButtonClass} w-full`}
        >
          {isSubmitting
            ? isSignUp
              ? "Creating account..."
              : "Signing in..."
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-widest">
          <span className="bg-surface px-3 text-muted-soft">Or continue with</span>
        </div>
      </div>

      <div className="space-y-2">
        {providers.map((provider) => {
          const enabled = enabledProviders[provider.id];
          const isLoading = pendingProvider === provider.id;

          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => handleSocialSignIn(provider.id)}
              disabled={isBusy || !enabled}
              title={
                enabled
                  ? undefined
                  : `${provider.label} sign-in is not configured yet.`
              }
              className="flex w-full items-center justify-center rounded-xl border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? `Redirecting to ${provider.label}...`
                : `Continue with ${provider.label}`}
            </button>
          );
        })}
      </div>

      {providers.some((provider) => !enabledProviders[provider.id]) && (
        <p className="text-center text-xs text-muted-soft">
          {providers
            .filter((provider) => !enabledProviders[provider.id])
            .map((provider) => provider.label)
            .join(", ")}{" "}
          sign-in is not configured yet.
        </p>
      )}

      <p className="text-center text-sm text-muted">
        {isSignUp ? "Already have an account? " : "New to ShopSphere? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-semibold text-accent transition-colors hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}
