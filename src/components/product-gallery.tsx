"use client";

import { useState } from "react";
import { ProductMedia } from "@/components/product-media";
import type { Product } from "@/lib/types";

export function ProductGallery({ product }: { product: Product }) {
  const images = product.images.length > 0 ? product.images : [null];
  const [selected, setSelected] = useState(0);

  return (
    <div>
      <ProductMedia
        product={product}
        src={images[selected]}
        variant="detail"
        className="aspect-square rounded-2xl ring-1 ring-border"
        priority
      />

      {images.length > 1 && (
        <div
          aria-label="Product images"
          className="mt-3 grid grid-cols-4 gap-3"
        >
          {images.map((image, index) => (
            <button
              key={`${image ?? "fallback"}-${index}`}
              type="button"
              onClick={() => setSelected(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-pressed={selected === index}
              className={`overflow-hidden rounded-xl ring-2 ring-offset-2 transition focus-visible:outline-none focus-visible:ring-accent ${
                selected === index
                  ? "ring-accent"
                  : "ring-transparent hover:ring-border-strong"
              }`}
            >
              <ProductMedia
                product={product}
                src={image}
                variant="thumb"
                className="aspect-square rounded-xl"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
