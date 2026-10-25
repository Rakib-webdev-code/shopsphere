"use client";

import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRightIcon, SparklesIcon } from "@/components/icons";
import { ProductCard } from "@/components/product-card";
import { Alert, primaryButtonClass } from "@/components/ui";
import { apiRequest } from "@/lib/api-client";
import type { AssistantReply } from "@/lib/assistant/types";

const EXAMPLE_PROMPTS = [
  "Find noise-cancelling headphones under $200",
  "Suggest a gift for a student under $50",
  "Compare two products for a home desk",
  "Show alternatives to an item that is out of stock",
] as const;

type ChatEntry = {
  id: string;
  role: "user" | "assistant";
  text: string;
  products?: AssistantReply["products"];
  followUps?: string[];
  notice?: string;
  mode?: AssistantReply["mode"];
  failedPrompt?: string;
};

const WELCOME: ChatEntry = {
  id: "welcome",
  role: "assistant",
  text: "Hi — I can search the live ShopSphere catalog in plain language. Tell me what you need, your budget, or the product you want to compare. I only show real products with the current database price and stock.",
};

function AssistantProductResults({
  products,
}: {
  products: NonNullable<ChatEntry["products"]>;
}) {
  return (
    <ul role="list" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {products.map((match) => (
        <li key={match.product.id} className="flex flex-col">
          <ProductCard product={match.product} />
          <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2 text-xs leading-5 text-muted">
            {match.reason}
          </p>
        </li>
      ))}
    </ul>
  );
}

function AssistantMessage({
  entry,
  onFollowUp,
  onRetry,
  isPending,
}: {
  entry: ChatEntry;
  onFollowUp: (prompt: string) => void;
  onRetry: (prompt: string) => void;
  isPending: boolean;
}) {
  const isUser = entry.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-full rounded-2xl px-4 py-3 text-sm leading-6 ${
          isUser
            ? "max-w-[85%] bg-accent-solid text-white"
            : "w-full border border-border bg-surface text-foreground"
        }`}
      >
        {!isUser && (
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              <SparklesIcon className="h-3.5 w-3.5" />
              Shopping assistant
            </span>
            {entry.mode && (
              <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-soft">
                {entry.mode === "ai" ? "AI-ranked" : "Catalog match"}
              </span>
            )}
          </div>
        )}

        <p className={isUser ? "whitespace-pre-wrap" : "text-muted-strong"}>
          {entry.text}
        </p>

        {entry.notice && (
          <p className="mt-2 rounded-xl bg-warning-soft px-3 py-2 text-xs leading-5 text-warning">
            {entry.notice}
          </p>
        )}

        {entry.products && entry.products.length > 0 && (
          <AssistantProductResults products={entry.products} />
        )}

        {entry.followUps && entry.followUps.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {entry.followUps.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => onFollowUp(prompt)}
                disabled={isPending}
                className="rounded-full border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-muted-strong transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {entry.failedPrompt && (
          <button
            type="button"
            onClick={() => onRetry(entry.failedPrompt as string)}
            disabled={isPending}
            className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent-soft disabled:opacity-50"
          >
            Try again
            <ArrowRightIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ThinkingBubble() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-surface px-4 py-4">
        <span className="sr-only">Searching the live catalog...</span>
        <div aria-hidden="true" className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-3 w-full animate-pulse rounded-full bg-surface-subtle" />
          <div className="h-3 w-3/4 animate-pulse rounded-full bg-surface-subtle" />
        </div>
      </div>
    </div>
  );
}

export function AssistantChat({
  referenceProductId = null,
}: {
  /**
   * Optional product context passed from a product page. The server still
   * looks the product up itself, so this value is only a hint.
   */
  referenceProductId?: string | null;
}) {
  const [messages, setMessages] = useState<ChatEntry[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const counter = useRef(0);

  function nextId() {
    counter.current += 1;
    return `message-${counter.current}`;
  }

  async function ask(question: string) {
    const trimmed = question.trim();

    if (!trimmed || isPending) {
      return;
    }

    setMessages((current) => [
      ...current,
      { id: nextId(), role: "user", text: trimmed },
    ]);
    setInput("");
    setIsPending(true);

    try {
      const reply = await apiRequest<AssistantReply>("/api/assistant", {
        method: "POST",
        body: JSON.stringify({
          message: trimmed,
          ...(referenceProductId ? { productId: referenceProductId } : {}),
        }),
      });

      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text: reply.message,
          products: reply.products,
          followUps: reply.followUps,
          notice: reply.notice,
          mode: reply.mode,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: nextId(),
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "I could not search the catalog just now. Please try again.",
          failedPrompt: trimmed,
        },
      ]);
    } finally {
      setIsPending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void ask(input);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void ask(input);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section
        aria-label="Shopping assistant conversation"
        className="rounded-2xl border border-border bg-surface-muted/60 p-4 sm:p-6"
      >
        <div
          className="space-y-4"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((entry) => (
            <AssistantMessage
              key={entry.id}
              entry={entry}
              onFollowUp={(prompt) => void ask(prompt)}
              onRetry={(prompt) => void ask(prompt)}
              isPending={isPending}
            />
          ))}
          {isPending && <ThinkingBubble />}
        </div>

        {messages.length === 1 && (
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-soft">
              Try asking
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => void ask(prompt)}
                  className="rounded-full border border-border-strong bg-surface px-3 py-2 text-left text-xs font-semibold text-muted-strong transition-colors hover:bg-accent-soft hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 border-t border-border pt-4">
          <label htmlFor="assistant-message" className="sr-only">
            Ask the shopping assistant
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <textarea
              id="assistant-message"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              maxLength={500}
              placeholder="e.g. Find a birthday gift under $60 for someone who likes coffee"
              className="min-h-20 w-full resize-y rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-soft focus:border-accent-bright focus:ring-2 focus:ring-accent-bright/20"
            />
            <button
              type="submit"
              disabled={isPending || !input.trim()}
              className={`${primaryButtonClass} w-full shrink-0 sm:w-auto`}
            >
              {isPending ? "Searching..." : "Ask assistant"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-soft">
            Press Enter to send, Shift + Enter for a new line. Questions are
            limited to 500 characters.
          </p>
        </form>
      </section>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-accent-border bg-accent-soft p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-accent-strong">
            <SparklesIcon className="h-4 w-4" />
            Grounded in the live catalog
          </h2>
          <ul className="mt-3 space-y-2 text-xs leading-5 text-accent-strong">
            <li>• Products, prices, ratings, and stock come from MongoDB.</li>
            <li>• Sold-out items are shown as sold out, never as available.</li>
            <li>• The assistant cannot change carts, orders, or inventory.</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">
            How ranking works
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            Without an AI provider configured, ShopSphere uses a deterministic
            catalog search and ranking mode. If a provider is configured on the
            server, it may rank the same verified candidates and add short
            explanations, but it cannot supply product names, prices, stock, or
            links.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-foreground">
            Shopping help only
          </h2>
          <p className="mt-2 text-xs leading-5 text-muted">
            Do not share payment details, passwords, or personal information. A
            human can help with account and order problems from the account
            pages.
          </p>
        </div>

        {isPending && (
          <Alert tone="info">
            Searching active products and checking current stock. Large catalogs
            can take a moment.
          </Alert>
        )}
      </aside>
    </div>
  );
}
