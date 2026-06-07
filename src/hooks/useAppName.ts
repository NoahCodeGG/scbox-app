import { useEffect, useState } from "react";
import { getName } from "@tauri-apps/api/app";

/**
 * Reads the app name (the configured `productName` from the Tauri config) at
 * runtime, once on mount. Returns `null` until the read resolves, and stays
 * `null` if it rejects so callers can render a fallback rather than crash.
 * StrictMode-safe via a `cancelled` flag guarding the post-unmount setState.
 */
export function useAppName(): string | null {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getName()
      .then((resolved) => {
        if (!cancelled) setName(resolved);
      })
      .catch(() => {
        // Reading the name is non-critical; leave it null so the UI omits it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return name;
}
