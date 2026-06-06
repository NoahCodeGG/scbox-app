import { useEffect, useRef, useState } from "react";

/**
 * Tracks how long `connected` has been continuously `false`. After 30 seconds,
 * sets `showDiagnostic` to `true`. Auto-hides the diagnostic panel when
 * `connected` becomes `true`. StrictMode-safe (clears timeout on cleanup).
 */
export function useConnectionDiagnostic(connected: boolean): {
  showDiagnostic: boolean;
  openDiagnostic: () => void;
  closeDiagnostic: () => void;
} {
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (connected) {
      // Connected → auto-hide diagnostic and clear any pending timer
      setShowDiagnostic(false);
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    } else {
      // Disconnected → start 30s timer if not already running
      if (timerRef.current === null) {
        timerRef.current = window.setTimeout(() => {
          setShowDiagnostic(true);
          timerRef.current = null;
        }, 30_000);
      }
    }

    // Cleanup on unmount or when effect re-runs
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [connected]);

  const openDiagnostic = () => {
    setShowDiagnostic(true);
  };

  const closeDiagnostic = () => {
    setShowDiagnostic(false);
  };

  return { showDiagnostic, openDiagnostic, closeDiagnostic };
}
