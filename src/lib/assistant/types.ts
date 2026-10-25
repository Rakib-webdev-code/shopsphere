import type { Product } from "@/lib/types";

/**
 * Shared client/server shapes for the shopping assistant.
 *
 * Product data is always serialized by the existing catalog service, so the
 * browser receives exactly the same trusted price, stock, and URL fields that
 * the storefront renders everywhere else.
 */
export type AssistantProductMatch = {
  product: Product;
  reason: string;
};

export type AssistantReply = {
  message: string;
  products: AssistantProductMatch[];
  followUps: string[];
  /**
   * `catalog` means the reply was produced from deterministic catalog search
   * only. `ai` means a configured provider ranked the verified candidates.
   * The UI must never present catalog mode as a live AI response.
   */
  mode: "catalog" | "ai";
  notice?: string;
};
