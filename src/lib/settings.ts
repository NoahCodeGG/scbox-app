// Pure normalization/validation for user settings. Kept DOM- and IPC-free so it
// is unit-testable in the node test env and reused on both the load and save
// paths. The clamping rules are the single source of truth for the bounds.

import type { Settings } from "../hooks/useSettings";
import { DEFAULT_CLICK_THROUGH_SHORTCUT } from "./shortcut";

/** Lowest valid TCP port. */
const MIN_PORT = 1;
/** Highest valid TCP port. */
const MAX_PORT = 65535;
/** Fallback port used when the configured one is out of range or not a number. */
export const DEFAULT_CLIENT_API_PORT = 6119;

/** Min/max Web Speech utterance rate (matches the Web Speech spec's usable range). */
const MIN_VOICE_RATE = 0.5;
const MAX_VOICE_RATE = 2.0;
/** Fallback rate when the configured one is not a finite number. */
const DEFAULT_VOICE_RATE = 1.0;

/** Clamp `value` to `[min, max]`. */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp the SC2 Client API port into the valid TCP range. A non-finite or
 * out-of-range value falls back to the default port (6119) rather than a
 * clamped boundary, since "0" or "99999" almost always means "unset/typo".
 */
export function normalizePort(port: number): number {
  if (!Number.isFinite(port)) return DEFAULT_CLIENT_API_PORT;
  const rounded = Math.trunc(port);
  if (rounded < MIN_PORT || rounded > MAX_PORT) return DEFAULT_CLIENT_API_PORT;
  return rounded;
}

/** Clamp the voice rate to the usable range; non-finite falls back to 1.0. */
export function normalizeVoiceRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_VOICE_RATE;
  return clamp(rate, MIN_VOICE_RATE, MAX_VOICE_RATE);
}

/**
 * Normalize the lead-time override: `null` (use each build's own lead time) is
 * preserved; a negative or non-finite number is treated as `null`; otherwise
 * the value is kept (clamped to >= 0).
 */
export function normalizeLeadTimeOverride(
  override: number | null,
): number | null {
  if (override === null) return null;
  if (!Number.isFinite(override) || override < 0) return null;
  return override;
}

/**
 * Normalize the active-build override: `null` (auto matchup selection) is
 * preserved, an explicit non-empty filename is kept, and an empty string or
 * `undefined` coerces to `null`.
 */
export function normalizeActiveBuildOverride(
  override: string | null | undefined,
): string | null {
  if (override === null || override === undefined) return null;
  const trimmed = override.trim();
  return trimmed === "" ? null : trimmed;
}

/** Valid theme values; anything else coerces to `"system"`. */
type Theme = "light" | "dark" | "system";

/**
 * Normalize the UI theme: only `"light"`, `"dark"`, and `"system"` are valid;
 * any other value (including `undefined` from an older settings.json) coerces to
 * `"system"` so the app follows the OS by default.
 */
export function normalizeTheme(theme: Theme | string | undefined): Theme {
  return theme === "light" || theme === "dark" || theme === "system"
    ? theme
    : "system";
}

/**
 * Normalize the click-through shortcut: a non-empty trimmed accelerator string
 * is kept; an empty string or `undefined` (older settings.json) falls back to
 * the default `CmdOrCtrl+Shift+S`.
 */
export function normalizeClickThroughShortcut(
  shortcut: string | undefined,
): string {
  if (typeof shortcut !== "string") return DEFAULT_CLICK_THROUGH_SHORTCUT;
  const trimmed = shortcut.trim();
  return trimmed === "" ? DEFAULT_CLICK_THROUGH_SHORTCUT : trimmed;
}

/**
 * Produce a fully-valid `Settings` from a possibly-out-of-range one. Applied
 * after loading (defending against a hand-edited settings.json) and before
 * saving (defending against UI input).
 */
export function normalizeSettings(raw: Settings): Settings {
  return {
    clientApiPort: normalizePort(raw.clientApiPort),
    leadTimeSecOverride: normalizeLeadTimeOverride(raw.leadTimeSecOverride),
    voiceEnabled: raw.voiceEnabled,
    recurringVoiceEnabled: raw.recurringVoiceEnabled !== false,
    voiceRate: normalizeVoiceRate(raw.voiceRate),
    clickThrough: raw.clickThrough,
    windowX: raw.windowX,
    windowY: raw.windowY,
    activeBuildOverride: normalizeActiveBuildOverride(raw.activeBuildOverride),
    theme: normalizeTheme(raw.theme),
    clickThroughShortcut: normalizeClickThroughShortcut(
      raw.clickThroughShortcut,
    ),
    prereleaseUpdates: raw.prereleaseUpdates === true,
  };
}
