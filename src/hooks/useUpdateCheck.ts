import { useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

/** State + actions for the auto-update flow exposed to the UI. */
export interface UpdateCheckState {
  /** True when `check()` found a newer version than the running app. */
  available: boolean;
  /** The available version string, or `null` when none / not yet checked. */
  version: string | null;
  /** True while a check or install is in flight (disables the buttons). */
  busy: boolean;
  /** Last error message, or `null`. Surfaced to the user; never thrown. */
  error: string | null;
  /** Whether the most recent check completed with no update available. */
  upToDate: boolean;
  /** Re-run the update check (e.g. the Settings "检查更新" button). */
  check: () => Promise<void>;
  /** Download + install the available update, then relaunch the app. */
  install: () => Promise<void>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Drives the Tauri 2 updater: checks for a newer signed release and, on demand,
 * downloads/installs it then relaunches. Runs one check on mount (cancel-safe
 * like `useAppVersion`).
 *
 * Every path is wrapped in try/catch and degrades to an `error` string rather
 * than throwing, so an offline machine or the placeholder pubkey (which makes
 * verification fail) never crashes the overlay or produces an uncaught
 * rejection.
 */
export function useUpdateCheck(): UpdateCheckState {
  const [available, setAvailable] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upToDate, setUpToDate] = useState(false);

  const runCheck = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    setUpToDate(false);
    try {
      const update = await check();
      if (update) {
        setAvailable(true);
        setVersion(update.version);
      } else {
        setAvailable(false);
        setVersion(null);
        setUpToDate(true);
      }
    } catch (err: unknown) {
      // Offline or placeholder-pubkey verification failure: degrade silently.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const install = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const update = await check();
      if (!update) {
        setAvailable(false);
        setVersion(null);
        setUpToDate(true);
        return;
      }
      await update.downloadAndInstall();
      await relaunch();
    } catch (err: unknown) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, []);

  // One check on mount; guard the post-unmount setState in case the check
  // resolves after the component is gone (StrictMode double-invoke safe).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const update = await check();
        if (cancelled) return;
        if (update) {
          setAvailable(true);
          setVersion(update.version);
        } else {
          setUpToDate(true);
        }
      } catch (err: unknown) {
        if (!cancelled) setError(errorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, version, busy, error, upToDate, check: runCheck, install };
}
