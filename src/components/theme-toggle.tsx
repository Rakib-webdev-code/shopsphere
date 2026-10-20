"use client";

import {
  MonitorIcon,
  MoonIcon,
  SunIcon,
} from "@/components/icons";
import { useTheme } from "@/components/theme-provider";
import type { ThemePreference } from "@/lib/theme";

const options: {
  value: ThemePreference;
  label: string;
  icon: typeof SunIcon;
}[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
];

export function ThemeToggle() {
  const { preference, resolvedTheme, setPreference } = useTheme();

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-border bg-surface p-0.5 shadow-sm"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = preference === option.value;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => setPreference(option.value)}
            aria-label={`Use ${option.label.toLowerCase()} theme`}
            aria-pressed={active}
            title={
              option.value === "system"
                ? `System theme (currently ${resolvedTheme})`
                : `${option.label} theme`
            }
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 ${
              active
                ? "bg-strong text-strong-foreground shadow-sm"
                : "text-muted-soft hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
          </button>
        );
      })}
    </div>
  );
}
