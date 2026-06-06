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

  // Apply saved position once on mount (using logical coordinates, which work
  // better on macOS Retina multi-monitor setups).
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

  // Persist window position on unmount (when the app closes). Uses logical
  // coordinates (better for macOS Retina multi-monitor). Validates the position
  // is within any monitor's bounds before saving.
  useEffect(() => {
    return () => {
      void (async () => {
        try {
          const pos = await window.outerPosition();
          const monitors = await availableMonitors();

          // Convert physical position to logical by dividing by scale factor.
          // On macOS Retina, outerPosition() returns physical pixels but we need
          // logical coordinates for setPosition(LogicalPosition).
          const currentMonitor = monitors.find((m) => {
            const { x: mx, y: my } = m.position;
            const { width, height } = m.size;
            return (
              pos.x >= mx &&
              pos.x < mx + width &&
              pos.y >= my &&
              pos.y < my + height
            );
          });

          if (!currentMonitor) {
            // Position is outside all monitors, don't save.
            return;
          }

          const scaleFactor = currentMonitor.scaleFactor;
          const logicalX = pos.x / scaleFactor;
          const logicalY = pos.y / scaleFactor;

          await saveSettingsRefForPosition.current({
            ...settingsRef.current,
            windowX: logicalX,
            windowY: logicalY,
          });
        } catch (e: unknown) {
          console.error("Failed to persist window position:", e);
        }
      })();
    };
    // Empty deps: the cleanup runs once on unmount, but uses refs for latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
