import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { normalizeSettings } from "../lib/settings";

/**
 * User settings persisted by the Rust `load_settings`/`save_settings` commands.
 * Mirrors the serde `Settings` struct in `src-tauri/src/settings.rs` (camelCase
 * keys). Keep field names aligned across the boundary.
 */
export interface Settings {
  /** Exact in-game name used to identify the local player. Empty when unset. */
  playerName: string;
  /** SC2 Client API port the poll loop hits (`-clientapi <port>`). */
  clientApiPort: number;
  /**
   * When set, overrides each build's `leadTimeSec`; `null` uses the build's own
   * value.
   */
  leadTimeSecOverride: number | null;
  /** Whether build-order voice cues are spoken at all. */
  voiceEnabled: boolean;
  /** Web Speech utterance rate (clamped 0.5–2.0). */
  voiceRate: number;
}

const DEFAULT_SETTINGS: Settings = {
  playerName: "",
  clientApiPort: 6119,
  leadTimeSecOverride: null,
  voiceEnabled: true,
  voiceRate: 1.0,
};

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
          setSettings(normalizeSettings(loaded));
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
    const normalized = normalizeSettings(next);
    try {
      setError(null);
      await invoke("save_settings", { settings: normalized });
      setSettings(normalized);
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

  return { settings, saveSettings, error };
}
