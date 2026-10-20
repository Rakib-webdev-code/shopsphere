export const THEME_STORAGE_KEY = "shopsphere-theme";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isThemePreference(
  value: string | null | undefined,
): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/**
 * Runs in the document head before the first paint. Keeping the script in one
 * place makes it easier to keep the inline bootstrap and the React provider in
 * sync.
 */
export const themeInitScript = `
(function () {
  try {
    var key = "${THEME_STORAGE_KEY}";
    var stored = localStorage.getItem(key);
    var preference =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    var dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var resolved = preference === "system" ? (dark ? "dark" : "light") : preference;
    var root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-preference", preference);
    root.style.colorScheme = resolved;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", resolved === "dark" ? "#09090b" : "#ffffff");
    }
  } catch (error) {}
})();
`;
