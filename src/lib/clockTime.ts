// UI-layer helpers for the build editor's per-step time field. Storage stays in
// raw seconds (TS `BuildStep.time: number`, Rust `f64`); these functions only
// translate between that and the human-friendly `mm:ss` shown in the form.

/**
 * Parse a clock-time string into seconds.
 *
 * Accepts either `mm:ss` (e.g. `"3:55"` / `"03:55"`, seconds segment 0–59) or a
 * plain seconds value with no colon (e.g. `"235"`). Returns `null` for any
 * invalid, negative, or non-numeric input.
 */
export function parseClockTime(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length !== 2) return null;
    const [minPart, secPart] = parts;
    if (!/^\d+$/.test(minPart) || !/^\d+$/.test(secPart)) return null;
    const minutes = Number(minPart);
    const seconds = Number(secPart);
    if (seconds > 59) return null;
    return minutes * 60 + seconds;
  }

  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return null;
  return value;
}

/**
 * Format a non-negative integer number of seconds as `MM:SS`, zero-padding both
 * segments to two digits (e.g. `235` → `"03:55"`, `17` → `"00:17"`).
 */
export function formatClockTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return `${mm}:${ss}`;
}
