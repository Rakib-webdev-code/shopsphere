import Link from "next/link";
import {
  ArrowRightIcon,
  CategoryGlyph,
  categoryArtworkGradient,
} from "@/components/icons";
import type { Category } from "@/lib/types";

type CategoryCardProps = {
  category: Category;
};

export function CategoryCard({ category }: CategoryCardProps) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-surface p-2 transition duration-300 hover:-translate-y-0.5 hover:border-accent-border hover:shadow-xl hover:shadow-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 dark:hover:shadow-black/40"
    >
      <div
        className={`relative flex aspect-[5/3] items-center justify-center overflow-hidden rounded-xl bg-linear-to-br ${categoryArtworkGradient(category.icon)}`}
      >
        <CategoryGlyph
          icon={category.icon}
          className="h-16 w-16 text-foreground/65 transition duration-300 group-hover:scale-105 sm:h-20 sm:w-20"
        />
        <span className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-muted-strong backdrop-blur transition-colors group-hover:bg-surface">
          <ArrowRightIcon className="h-4 w-4" />
        </span>
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold text-foreground transition-colors group-hover:text-accent">
            {category.name}
          </h3>
          <span className="shrink-0 text-xs font-medium text-muted-soft">
            {category.productCount}{" "}
            {category.productCount === 1 ? "item" : "items"}
          </span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-muted">
          {category.tagline}
        </p>
      </div>
    </Link>
  );
}
