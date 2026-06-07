import { useEffect } from "react";

/** The global UI theme; `"system"` follows the OS appearance. */
export type Theme = "light" | "dark" | "system";

/** The media query used to detect the OS dark appearance. */
const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * Apply a global light/dark theme by toggling a `.dark` class on
 * `<html>` (`document.documentElement`). Runs per-window, so both the main
 * window and the overlay manage their own webview's `document` independently.
 *
 * - `"dark"`/`"light"` force the class on/off.
 * - `"system"` follows `prefers-color-scheme: dark` and re-applies live when the
 *   OS appearance changes, cleaning up the media-query listener on unmount or
 *   when the theme changes.
 */
export function useApplyTheme(theme: Theme): void {
  useEffect(() => {
    const root = document.documentElement;

    if (theme !== "system") {
      root.classList.toggle("dark", theme === "dark");
      return;
    }

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const apply = (): void => {
      root.classList.toggle("dark", media.matches);
    };
    apply();
    media.addEventListener("change", apply);
    return () => {
      media.removeEventListener("change", apply);
    };
  }, [theme]);
}
