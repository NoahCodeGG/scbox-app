import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/**
 * Reads the app version (from the Tauri config) at runtime, once on mount.
 * Returns `null` until the read resolves, and stays `null` if it rejects so
 * callers can render a fallback rather than crash. StrictMode-safe via a
 * `cancelled` flag guarding the post-unmount setState.
 */
export function useAppVersion(): string | null {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVersion()
      .then((resolved) => {
        if (!cancelled) setVersion(resolved);
      })
      .catch(() => {
        // Reading the version is non-critical; leave it null so the UI omits it.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return version;
}
