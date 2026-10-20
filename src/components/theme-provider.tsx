"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import {
  isThemePreference,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // The inline script in the document head has already applied the stored
  // theme. Starting with "system" on both server and client avoids a hydration
  // mismatch; the layout effect below reads localStorage before paint.
  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  const applyPreference = useCallback(
    (nextPreference: ThemePreference): ResolvedTheme => {
      const resolved =
        nextPreference === "system" ? systemTheme() : nextPreference;
      const root = document.documentElement;

      root.setAttribute("data-theme", resolved);
      root.setAttribute("data-theme-preference", nextPreference);
      root.style.colorScheme = resolved;

      const themeColor = document.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      if (themeColor) {
        themeColor.content = resolved === "dark" ? "#09090b" : "#ffffff";
      }

      setResolvedTheme(resolved);
      return resolved;
    },
    [],
  );

  // Re-apply on mount. This also handles React Strict Mode's development
  // remount, which resets attributes managed outside JSX.
  useIsomorphicLayoutEffect(() => {
    let stored: string | null = null;

    try {
      stored = localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // localStorage can be unavailable in privacy-restricted contexts.
    }

    const nextPreference = isThemePreference(stored) ? stored : "system";
    setPreferenceState(nextPreference);
    applyPreference(nextPreference);
  }, [applyPreference]);

  useEffect(() => {
    if (preference !== "system") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyPreference("system");

    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [preference, applyPreference]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextPreference = isThemePreference(event.newValue)
        ? event.newValue
        : "system";
      setPreferenceState(nextPreference);
      applyPreference(nextPreference);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [applyPreference]);

  const setPreference = useCallback(
    (nextPreference: ThemePreference) => {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, nextPreference);
      } catch {
        // The theme still applies for this page even if persistence is blocked.
      }

      setPreferenceState(nextPreference);
      applyPreference(nextPreference);
    },
    [applyPreference],
  );

  return (
    <ThemeContext.Provider
      value={{ preference, resolvedTheme, setPreference }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside a ThemeProvider.");
  }

  return context;
}
