import { SearchIcon } from "@/components/icons";

type StorefrontSearchProps = {
  defaultValue?: string;
  variant?: "header" | "hero" | "inline";
  className?: string;
};

const formClasses = {
  header:
    "relative flex w-full items-center overflow-hidden rounded-full border border-border-strong bg-surface transition focus-within:border-accent-bright focus-within:ring-2 focus-within:ring-accent-bright/20",
  hero: "relative flex w-full items-center overflow-hidden rounded-full border border-border bg-surface shadow-lg shadow-black/10 transition focus-within:border-accent-bright focus-within:ring-2 focus-within:ring-accent-bright/20 dark:shadow-black/40",
  inline:
    "relative flex w-full items-center overflow-hidden rounded-full border border-border-strong bg-surface transition focus-within:border-accent-bright focus-within:ring-2 focus-within:ring-accent-bright/20",
} as const;

const inputClasses = {
  header:
    "w-full bg-transparent py-2 pl-10 pr-12 text-sm text-foreground outline-none placeholder:text-muted-soft",
  hero: "w-full bg-transparent py-3.5 pl-12 pr-28 text-sm text-foreground outline-none placeholder:text-muted-soft sm:text-base",
  inline:
    "w-full bg-transparent py-3 pl-11 pr-28 text-sm text-foreground outline-none placeholder:text-muted-soft",
} as const;

const buttonClasses = {
  header:
    "absolute bottom-1 right-1 top-1 inline-flex items-center justify-center rounded-full bg-accent-solid px-3 text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
  hero: "absolute bottom-1.5 right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-accent-solid px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
  inline:
    "absolute bottom-1.5 right-1.5 top-1.5 inline-flex items-center justify-center rounded-full bg-accent-solid px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-solid-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
} as const;

export function StorefrontSearch({
  defaultValue = "",
  variant = "header",
  className = "",
}: StorefrontSearchProps) {
  const isHero = variant === "hero";

  return (
    <form
      action="/shop"
      method="get"
      role="search"
      className={`${formClasses[variant]} ${className}`}
    >
      <SearchIcon
        className={`pointer-events-none absolute text-muted-soft ${
          isHero ? "left-4 h-5 w-5" : "left-3.5 h-4 w-4"
        }`}
      />
      <input
        type="search"
        name="q"
        aria-label="Search products"
        placeholder={
          variant === "hero"
            ? "Search products or categories"
            : "Search products"
        }
        defaultValue={defaultValue}
        className={inputClasses[variant]}
      />
      <button type="submit" className={buttonClasses[variant]}>
        {variant === "header" ? (
          <>
            <SearchIcon className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </>
        ) : (
          "Search"
        )}
      </button>
    </form>
  );
}
