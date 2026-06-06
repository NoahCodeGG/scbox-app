import { useEffect, useRef } from "react";
import {
  getCurrentWindow,
  LogicalPosition,
  availableMonitors,
} from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import type { Settings } from "./useSettings";

interface UseWindowControlsOptions {
  settings: Settings;
  saveSettings: (next: Settings) => Promise<void>;
}

/**
 * Applies window position and click-through state from settings, listens for
 * the global shortcut to disable click-through, and persists position on close.
 * StrictMode-safe: the listener unsubscribes on cleanup.
 */
export function useWindowControls({
  settings,
  saveSettings,
}: UseWindowControlsOptions): void {
  const window = getCurrentWindow();
  const positionAppliedRef = useRef(false);

  // Apply saved position once on mount.
  useEffect(() => {
    if (
      !positionAppliedRef.current &&
      settings.windowX !== null &&
      settings.windowY !== null
    ) {
      void window
        .setPosition(new LogicalPosition(settings.windowX, settings.windowY))
        .catch((e: unknown) => {
          console.error("Failed to restore window position:", e);
        });
      positionAppliedRef.current = true;
    }
  }, [settings.windowX, settings.windowY, window]);

  // Apply click-through whenever it changes.
  useEffect(() => {
    void window.setIgnoreCursorEvents(settings.clickThrough).catch((e: unknown) => {
      console.error("Failed to set ignore cursor events:", e);
    });
  }, [settings.clickThrough, window]);

  // Listen for global shortcut to toggle click-through off.
  // Use a ref to capture the latest saveSettings to avoid recreating the listener
  // on every settings change, which could cause the listener to miss updates.
  const saveSettingsRef = useRef(saveSettings);
  useEffect(() => {
    saveSettingsRef.current = saveSettings;
  }, [saveSettings]);

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    void (async () => {
      unlisten = await listen<void>("ui://toggle-clickthrough", async () => {
        // Read the current settings via a fresh call to avoid stale closure
        const currentSettings = settings;
        await saveSettingsRef.current({ ...currentSettings, clickThrough: false });
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
  }, [settings]);

  // Persist window position on unmount (when the window closes, React unmounts).
  // Use refs to capture the latest values to avoid stale closure in cleanup.
  const settingsRef = useRef(settings);
  const saveSettingsRefForPosition = useRef(saveSettings);
  useEffect(() => {
    settingsRef.current = settings;
    saveSettingsRefForPosition.current = saveSettings;
  });

  useEffect(() => {
    return () => {
      void (async () => {
        try {
          const pos = await window.outerPosition();
          const monitors = await availableMonitors();

          // Check if position is within any monitor's bounds (multi-screen safe).
          const isWithinBounds = monitors.some((monitor) => {
            const { x: mx, y: my } = monitor.position;
            const { width, height } = monitor.size;
            return (
              pos.x >= mx &&
              pos.x < mx + width &&
              pos.y >= my &&
              pos.y < my + height
            );
          });

          // Only persist if within bounds (avoid saving invalid positions).
          if (isWithinBounds) {
            await saveSettingsRefForPosition.current({
              ...settingsRef.current,
              windowX: pos.x,
              windowY: pos.y,
            });
          }
        } catch (e: unknown) {
          console.error("Failed to persist window position:", e);
        }
      })();
    };
    // Empty deps: the cleanup runs once on unmount, but uses refs for latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
