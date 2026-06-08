import { useCallback, useEffect, useState } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";

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
 * Drives the Tauri 2 updater across two channels:
 *
 * - **Stable** (default, `prereleaseUpdates` off): the plugin's JS `check()`
 *   resolves the static `releases/latest` endpoint; an available update is
 *   surfaced and installed on demand via {@link UpdateCheckState.install}.
 * - **Pre-release** (`prereleaseUpdates` on): the JS `check()` cannot include
 *   pre-releases, so checking invokes the Rust `check_prerelease_update`
 *   command, which queries the GitHub Releases API, verifies, and installs in
 *   one step. It returns the installed version (or `null` when up to date); a
 *   non-null result means the app must relaunch.
 *
 * Runs one check on mount (cancel-safe like `useAppVersion`). Every path is
 * wrapped in try/catch and degrades to an `error` string rather than throwing,
 * so an offline machine or a verification failure never crashes the overlay or
 * produces an uncaught rejection.
 */
export function useUpdateCheck(prereleaseUpdates = false): UpdateCheckState {
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
      if (prereleaseUpdates) {
        // Pre-release: the Rust command checks AND installs in one call.
        // A non-null version means an update was installed → relaunch.
        const installedVersion = await invoke<string | null>(
          "check_prerelease_update",
        );
        if (installedVersion) {
          setAvailable(true);
          setVersion(installedVersion);
          await relaunch();
        } else {
          setAvailable(false);
          setVersion(null);
          setUpToDate(true);
        }
        return;
      }
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
      // Offline, placeholder-pubkey verification failure, or a failed
      // pre-release install: degrade to a visible error instead of crashing.
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [prereleaseUpdates]);

  const install = useCallback(async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (prereleaseUpdates) {
        // Pre-release install is the same one-shot check-and-install command.
        const installedVersion = await invoke<string | null>(
          "check_prerelease_update",
        );
        if (!installedVersion) {
          setAvailable(false);
          setVersion(null);
          setUpToDate(true);
          return;
        }
        setVersion(installedVersion);
        await relaunch();
        return;
      }
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
  }, [prereleaseUpdates]);

  // One check on mount; guard the post-unmount setState in case the check
  // resolves after the component is gone (StrictMode double-invoke safe).
  // The mount check only *detects* an update on both channels — it never
  // auto-installs — so the pre-release path is the cheap stable `check()` too;
  // the user must press 检查更新 to trigger the installing Rust command.
  useEffect(() => {
    let cancelled = false;
    setBusy(true);
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
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { available, version, busy, error, upToDate, check: runCheck, install };
}
