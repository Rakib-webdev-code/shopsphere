"use client";

import Image from "next/image";
import { useState } from "react";
import {
  CategoryGlyph,
  categoryArtworkGradient,
} from "@/components/icons";
import { isAllowedRemoteImageSrc } from "@/lib/remote-image-hosts";
import type { Product, ProductIconName } from "@/lib/types";

type ProductMediaProps = {
  product: Product;
  src?: string | null;
  variant?: "card" | "detail" | "hero" | "thumb";
  className?: string;
  priority?: boolean;
};

const glyphClasses = {
  card: "h-20 w-20 sm:h-24 sm:w-24",
  detail: "h-40 w-40 sm:h-56 sm:w-56",
  hero: "h-36 w-36 sm:h-48 sm:w-48",
  thumb: "h-10 w-10",
} as const;

const sizes = {
  card: "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
  detail: "(max-width: 1024px) 100vw, 50vw",
  hero: "(max-width: 1024px) 100vw, 45vw",
  thumb: "80px",
} as const;

export function ProductMedia({
  product,
  src,
  variant = "card",
  className = "",
  priority = false,
}: ProductMediaProps) {
  const image = src ?? product.images[0] ?? null;

  return (
    <MediaThumb
      src={image}
      alt={product.name}
      icon={product.category?.icon ?? "backpack"}
      variant={variant}
      className={className}
      priority={priority}
    />
  );
}

export function MediaThumb({
  src,
  alt,
  icon = "backpack",
  variant = "card",
  className = "",
  priority = false,
}: {
  src: string | null;
  alt: string;
  icon?: ProductIconName;
  variant?: "card" | "detail" | "hero" | "thumb";
  className?: string;
  priority?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  const gradient = categoryArtworkGradient(icon);
  const failed = Boolean(src && failedSrc === src);
  const allowed = Boolean(src && isAllowedRemoteImageSrc(src));

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${gradient} ${className}`}
    >
      {src && allowed && !failed ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes[variant]}
          priority={priority}
          unoptimized={src.endsWith(".svg")}
          onError={() => setFailedSrc(src)}
          className="object-cover"
        />
      ) : (
        <div
          role="img"
          aria-label={alt}
          className="flex h-full w-full items-center justify-center text-foreground/55"
        >
          <CategoryGlyph icon={icon} className={glyphClasses[variant]} />
        </div>
      )}
    </div>
  );
}
