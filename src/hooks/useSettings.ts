import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * User settings persisted by the Rust `load_settings`/`save_settings` commands.
 * Mirrors the serde `Settings` struct in `src-tauri/src/settings.rs` (camelCase
 * `playerName`). Keep field names aligned across the boundary.
 */
export interface Settings {
  /** Exact in-game name used to identify the local player. Empty when unset. */
  playerName: string;
}

const DEFAULT_SETTINGS: Settings = { playerName: "" };

/** UI state surfaced by the settings hook. */
export interface SettingsState {
  /** Current settings (defaults until the load resolves). */
  settings: Settings;
  /** Persist new settings, updating local state on success. */
  saveSettings: (next: Settings) => Promise<void>;
  /** Set when a load/save `invoke` rejected; null otherwise. */
  error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads settings once on mount via the Rust `load_settings` command and exposes
 * an immutable `saveSettings`. A missing file resolves to defaults on the Rust
 * side, so first run is not an error. StrictMode's dev double-invoke just loads
 * twice (idempotent); there is no listener to leak.
 */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loaded = await invoke<Settings>("load_settings");
        if (!cancelled) {
          setError(null);
          setSettings(loaded);
        }
      } catch (e: unknown) {
        if (!cancelled) setError(errorMessage(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveSettings = useCallback(async (next: Settings): Promise<void> => {
    try {
      setError(null);
      await invoke("save_settings", { settings: next });
      setSettings(next);
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

  return { settings, saveSettings, error };
}
