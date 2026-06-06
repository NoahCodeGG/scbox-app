import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { BuildOrder, LoadResult, StoredBuild } from "../types/build";
import { FALLBACK_BUILD } from "../lib/builds";

/** Filename used for the in-memory fallback's `StoredBuild` wrapper. */
const FALLBACK_FILENAME = "terran-standard.json";

/** UI state surfaced by the build-order loader hook. */
export interface BuildOrdersState {
  /** Builds loaded from the app-data dir (or the bundled fallback on hard fail). */
  builds: BuildOrder[];
  /** Loaded builds paired with their source filename, for the editor. */
  stored: StoredBuild[];
  /** Per-file parse errors reported by the Rust command (non-fatal). */
  errors: string[];
  /** Set when the `invoke` itself rejected; null on success. */
  loadError: string | null;
  /** Re-run the load. Safe to call repeatedly. */
  reload: () => void;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads user-editable build orders from the app-data `builds/` dir via the Rust
 * `load_build_orders` command. The command seeds a bundled default on first run.
 *
 * On a hard `invoke` failure the hook falls back to the bundled default build
 * (kept in memory) and surfaces `loadError` so the UI can show it rather than
 * leaving the player with nothing. Per-file parse failures arrive in `errors`.
 *
 * Exposes both `builds` (plain orders, for scheduling/selection) and `stored`
 * (orders paired with their filename, for the editor's save/delete).
 */
export function useBuildOrders(): BuildOrdersState {
  const [stored, setStored] = useState<StoredBuild[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Stable identity so callers can safely use `reload` in effect deps without
  // triggering spurious re-runs. The `void` wrapper keeps the public signature
  // synchronous (() => void) while the async work runs fire-and-forget.
  const reload = useCallback((): void => {
    void (async () => {
      try {
        const result = await invoke<LoadResult>("load_build_orders");
        setLoadError(null);
        setErrors(result.errors);
        setStored(result.builds);
      } catch (e: unknown) {
        // Hard failure: surface the error but keep guiding with the bundled build.
        setLoadError(errorMessage(e));
        setErrors([]);
        setStored([{ filename: FALLBACK_FILENAME, build: FALLBACK_BUILD }]);
      }
    })();
  }, []);

  // Load once on mount. StrictMode's dev double-invoke just loads twice, which
  // is idempotent (the command re-reads the dir); no listener to leak here.
  useEffect(() => {
    reload();
  }, [reload]);

  return { builds: stored.map((s) => s.build), stored, errors, loadError, reload };
}
