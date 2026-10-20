import type { ProductIconName } from "@/lib/types";

type IconProps = {
  className?: string;
};

export function SearchIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function CartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 1.9-1.4L21 7H6" />
      <circle cx="10" cy="20" r="1.25" />
      <circle cx="18" cy="20" r="1.25" />
    </svg>
  );
}

export function ArrowRightIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function CheckIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 12.5 4.2 4.2L19 6.8" />
    </svg>
  );
}

export function StarIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m12 3.6 2.5 5.1 5.6.8-4.1 4 1 5.6-5-2.7-5 2.7 1-5.6-4.1-4 5.6-.8L12 3.6Z" />
    </svg>
  );
}

export function SparklesIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.5 13.4 8 18 9.4 13.4 11 12 15.5 10.6 11 6 9.4 10.6 8 12 3.5Z" />
      <path d="M5 15.5 5.8 18l2.5.8-2.5.8L5 22l-.8-2.4-2.5-.8 2.5-.8L5 15.5Z" />
      <path d="M19 14.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </svg>
  );
}

export function SunIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 8.5 8.5 0 1 0 20.5 14.2Z" />
    </svg>
  );
}

export function MonitorIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="4" width="18" height="12.5" rx="2" />
      <path d="M8 20.5h8M12 16.5v4" />
    </svg>
  );
}

export function MenuIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function XIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function PackageIcon({ className = "h-6 w-6" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m4 7.5 8-4 8 4v9l-8 4-8-4v-9Z" />
      <path d="m4 7.5 8 4 8-4" />
      <path d="M12 11.5v9" />
      <path d="m8 5.5 8 4" />
    </svg>
  );
}

export function UserIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function HeartIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 20.2 4.6 13a5 5 0 0 1 7.1-7l.3.3.3-.3a5 5 0 0 1 7.1 7l-7.4 7.2Z" />
    </svg>
  );
}

export function TrashIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4 7h16M9 7V4h6v3M6.5 7l.8 13h9.4l.8-13M10 11v5M14 11v5" />
    </svg>
  );
}

export function PencilIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" />
      <path d="m14 7 3 3" />
    </svg>
  );
}

export function ShieldIcon({ className = "h-5 w-5" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function MinusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

export function PlusIcon({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

type ProductGlyphProps = IconProps & {
  name: ProductIconName;
};

/**
 * Local SVG artwork keeps the demo catalog free of remote image dependencies.
 * The glyph is decorative; product names are always rendered next to it.
 */
export function ProductGlyph({
  name,
  className = "h-20 w-20",
}: ProductGlyphProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {name === "headphones" && (
        <g>
          <path d="M13 35v-3a19 19 0 0 1 38 0v3" />
          <rect x="9" y="33" width="10" height="18" rx="5" />
          <rect x="45" y="33" width="10" height="18" rx="5" />
        </g>
      )}
      {name === "speaker" && (
        <g>
          <rect x="18" y="9" width="28" height="46" rx="7" />
          <circle cx="32" cy="38" r="8" />
          <circle cx="32" cy="22" r="2" />
          <path d="M25 14h14" />
        </g>
      )}
      {name === "lamp" && (
        <g>
          <path d="M22 14h20l8 18H14l8-18Z" />
          <path d="M32 32v18" />
          <path d="M22 53h20" />
          <path d="M28 14v-2h8v2" />
        </g>
      )}
      {name === "keyboard" && (
        <g>
          <rect x="8" y="21" width="48" height="25" rx="5" />
          <path d="M16 29h3M24 29h3M32 29h3M40 29h3M48 29h1M16 37h3M24 37h3M32 37h3M40 37h3M48 37h1M23 45h18" />
        </g>
      )}
      {name === "mug" && (
        <g>
          <path d="M17 19h25v27a6 6 0 0 1-6 6H23a6 6 0 0 1-6-6V19Z" />
          <path d="M42 25h5a7 7 0 0 1 0 14h-5" />
          <path d="M24 11v4M33 8v7" />
        </g>
      )}
      {name === "throw" && (
        <g>
          <path d="M14 17h36v30H14z" />
          <path d="M14 27h36M14 37h36M27 17v30" />
          <path d="M18 47v4M46 47v4" />
        </g>
      )}
      {name === "backpack" && (
        <g>
          <path d="M20 24a12 12 0 0 1 24 0v27H20V24Z" />
          <path d="M26 24v-4a6 6 0 0 1 12 0v4" />
          <path d="M20 38h24" />
          <path d="M27 44h10" />
          <path d="M20 30h4M40 30h4" />
        </g>
      )}
      {name === "watch" && (
        <g>
          <circle cx="32" cy="32" r="13" />
          <path d="m26 20 1-10h10l1 10" />
          <path d="m26 44 1 10h10l1-10" />
          <path d="M32 25v8l5 3" />
        </g>
      )}
      {name === "sneaker" && (
        <g>
          <path d="M12 40c8-2 13-6 18-14l4 4c3 5 8 7 16 8 3 0 5 2 5 5v4H12v-7Z" />
          <path d="M12 45h43" />
          <path d="m25 34 4 4M32 30l4 4" />
        </g>
      )}
      {name === "bottle" && (
        <g>
          <path d="M25 10h14v8l3 5v25a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V23l3-5v-8Z" />
          <path d="M25 18h14" />
          <path d="M32 29v15" />
          <path d="M27 12h10" />
        </g>
      )}
      {name === "diffuser" && (
        <g>
          <path d="M21 29h22l3 24H18l3-24Z" />
          <path d="M27 29v-6a5 5 0 0 1 10 0v6" />
          <path d="M31 16c0-4 4-5 4-8M39 15c0-3 3-4 3-6" />
          <path d="M26 38h12" />
        </g>
      )}
      {name === "yoga-mat" && (
        <g>
          <rect x="10" y="24" width="40" height="18" rx="9" />
          <circle cx="45" cy="33" r="9" />
          <path d="M45 24v18" />
          <path d="M19 33h17" />
        </g>
      )}
    </svg>
  );
}

const categoryAccents: Record<ProductIconName, string> = {
  headphones: "from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900",
  speaker: "from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900",
  lamp: "from-zinc-50 to-zinc-200 dark:from-zinc-900 dark:to-zinc-800",
  keyboard: "from-lime-50 to-emerald-100 dark:from-lime-950 dark:to-emerald-900",
  mug: "from-emerald-50 to-lime-100 dark:from-emerald-950 dark:to-lime-900",
  throw: "from-cyan-50 to-emerald-100 dark:from-cyan-950 dark:to-emerald-900",
  backpack: "from-teal-50 to-cyan-100 dark:from-teal-950 dark:to-cyan-900",
  watch: "from-zinc-50 to-emerald-100 dark:from-zinc-900 dark:to-emerald-950",
  sneaker: "from-lime-50 to-teal-100 dark:from-lime-950 dark:to-teal-900",
  bottle: "from-cyan-50 to-emerald-100 dark:from-cyan-950 dark:to-emerald-900",
  diffuser: "from-emerald-50 to-lime-100 dark:from-emerald-950 dark:to-lime-900",
  "yoga-mat": "from-teal-50 to-emerald-100 dark:from-teal-950 dark:to-emerald-900",
};

type CategoryGlyphProps = IconProps & {
  icon: ProductIconName;
  tone?: keyof typeof categoryAccents;
};

export function CategoryGlyph({
  icon,
  className = "h-16 w-16",
}: CategoryGlyphProps) {
  return <ProductGlyph name={icon} className={className} />;
}

export function categoryArtworkGradient(icon: ProductIconName) {
  return categoryAccents[icon];
}
