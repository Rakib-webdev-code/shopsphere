const usdFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Prices are stored in cents so they stay whole numbers.
 * Example: 24900 -> "$249.00"
 */
export function formatPrice(priceInCents: number) {
  return usdFormatter.format(priceInCents / 100);
}
