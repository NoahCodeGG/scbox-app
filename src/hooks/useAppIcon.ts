import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * Reads the bundled app icon as a base64 PNG data URL from the Rust `app_icon`
 * command, once on mount. Returns `null` until the invoke resolves, and stays
 * `null` if it rejects so callers can render an empty placeholder rather than
 * crash. StrictMode-safe via a `cancelled` flag guarding the post-unmount
 * setState.
 */
export function useAppIcon(): string | null {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    invoke<string>("app_icon")
      .then((resolved) => {
        if (!cancelled) setIcon(resolved);
      })
      .catch(() => {
        // Reading the icon is non-critical; leave it null so the UI omits it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return icon;
}
