import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { normalizeSettings } from "../lib/settings";
import { SETTINGS_CHANGED_EVENT } from "../lib/events";

/**
 * User settings persisted by the Rust `load_settings`/`save_settings` commands.
 * Mirrors the serde `Settings` struct in `src-tauri/src/settings.rs` (camelCase
 * keys). Keep field names aligned across the boundary.
 */
export interface Settings {
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
  /** Whether the overlay window passes clicks through to the game. */
  clickThrough: boolean;
  /** Persisted window X position (logical pixels). `null` uses Tauri's default. */
  windowX: number | null;
  /** Persisted window Y position (logical pixels). `null` uses Tauri's default. */
  windowY: number | null;
  /** Manually-chosen active build filename; `null` uses matchup auto-select. */
  activeBuildOverride: string | null;
  /** Global UI theme; `"system"` follows the OS appearance. */
  theme: "light" | "dark" | "system";
  /** Global shortcut (Tauri accelerator) that toggles overlay click-through. */
  clickThroughShortcut: string;
}

const DEFAULT_SETTINGS: Settings = {
  clientApiPort: 6119,
  leadTimeSecOverride: null,
  voiceEnabled: true,
  voiceRate: 1.0,
  clickThrough: false,
  windowX: null,
  windowY: null,
  activeBuildOverride: null,
  theme: "system",
  clickThroughShortcut: "CmdOrCtrl+Shift+S",
};

/** UI state surfaced by the settings hook. */
export interface SettingsState {
  /** Current settings (defaults until the load resolves). */
  settings: Settings;
  /** Persist new settings, updating local state on success. */
  saveSettings: (next: Settings) => Promise<void>;
  /** Re-load settings from disk (e.g. after another window saved). */
  reload: () => Promise<void>;
  /** Set when a load/save `invoke` rejected; null otherwise. */
  error: string | null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Loads settings via the Rust `load_settings` command and exposes an immutable
 * `saveSettings` plus a `reload` for cross-window sync. A missing file resolves
 * to defaults on the Rust side, so first run is not an error. StrictMode's dev
 * double-invoke just loads twice (idempotent); there is no listener to leak.
 *
 * `saveSettings` emits `SETTINGS_CHANGED_EVENT` after a successful persist so
 * the overlay window can `reload()` and pick up the new values live.
 */
export function useSettings(): SettingsState {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    try {
      const loaded = await invoke<Settings>("load_settings");
      setError(null);
      setSettings(normalizeSettings(loaded));
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

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
      // Notify other windows (the overlay) to reload settings live.
      void emit(SETTINGS_CHANGED_EVENT);
    } catch (e: unknown) {
      setError(errorMessage(e));
    }
  }, []);

  return { settings, saveSettings, reload, error };
}
