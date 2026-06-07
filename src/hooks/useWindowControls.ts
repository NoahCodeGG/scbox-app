import { useEffect, useRef } from "react";
import {
  getCurrentWindow,
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

  // Window position is now restored in Rust setup (src-tauri/src/lib.rs) to
  // avoid visible jump from default position. Frontend no longer needs to call
  // setPosition on mount.

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

  // Persist window position on window close. Uses logical coordinates (better
  // for macOS Retina multi-monitor). Listens for the close-requested event
  // instead of relying on React unmount (which doesn't fire when Tauri window
  // is closed). Prevents default close to ensure async save completes.
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void (async () => {
      unlisten = await window.onCloseRequested(async (event) => {
        // Prevent default close to allow async save to complete.
        event.preventDefault();

        try {
          const pos = await window.outerPosition();
          const monitors = await availableMonitors();

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

          if (currentMonitor) {
            const scaleFactor = currentMonitor.scaleFactor;
            const logicalX = pos.x / scaleFactor;
            const logicalY = pos.y / scaleFactor;

            await saveSettingsRefForPosition.current({
              ...settingsRef.current,
              windowX: logicalX,
              windowY: logicalY,
            });
          }
        } catch (e: unknown) {
          console.error("Failed to persist window position:", e);
        }

        // Do NOT exit the app here. This hook runs in the OVERLAY window; the
        // Rust close handler (src-tauri/src/lib.rs) hides the overlay so it can
        // be relaunched from the dashboard. Quitting is the 退出 button / Cmd+Q.
      });
    })();

    return () => {
      if (unlisten) unlisten();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
