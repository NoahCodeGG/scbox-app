// Pure keyboard-shortcut helpers. DOM- and IPC-free so they unit-test in the
// node env. `buildAccelerator` turns a keyboard event into a Tauri accelerator
// string (the `CmdOrCtrl+Shift+S` style used by tauri-plugin-global-shortcut);
// `formatAccelerator` renders one for display.

/** Default click-through toggle accelerator; mirrors the Rust/TS default. */
export const DEFAULT_CLICK_THROUGH_SHORTCUT = "CmdOrCtrl+Shift+S";

/** The subset of a `KeyboardEvent` `buildAccelerator` reads (testable shape). */
export interface ShortcutKeyEvent {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** The `KeyboardEvent.key` value (e.g. `"a"`, `"F5"`, `"1"`, `"Shift"`). */
  key: string;
  /** Optional `KeyboardEvent.code` (e.g. `"KeyA"`, `"Digit1"`); unused today. */
  code?: string;
}

/** Keys that are themselves modifiers — never a valid "main" key on their own. */
const MODIFIER_KEYS = new Set([
  "Control",
  "Meta",
  "Shift",
  "Alt",
  "AltGraph",
  "OS",
]);

/**
 * Derive the accelerator's "main" key (the non-modifier part) from a key value.
 * Returns a Tauri-accepted token (an uppercase letter, a digit, or `F1`–`F24`)
 * or `null` when the key is a pure modifier or otherwise unusable.
 */
function mainKeyToken(key: string): string | null {
  if (MODIFIER_KEYS.has(key)) return null;
  // Single letter -> uppercase (e.g. "a" -> "A").
  if (/^[a-zA-Z]$/.test(key)) return key.toUpperCase();
  // Single digit (top-row or numpad both report the digit in `key`).
  if (/^[0-9]$/.test(key)) return key;
  // Function keys F1–F24.
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) return key;
  return null;
}

/**
 * Build a Tauri accelerator string from a keyboard event. Requires at least one
 * modifier (Ctrl/Meta/Alt — Shift alone does not count) AND a non-modifier main
 * key; otherwise returns `null`. Ctrl and Meta both map to `CmdOrCtrl` so the
 * shortcut is cross-platform. Order is `CmdOrCtrl`, `Shift`, `Alt`, then the key.
 */
export function buildAccelerator(e: ShortcutKeyEvent): string | null {
  const main = mainKeyToken(e.key);
  if (main === null) return null;

  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("CmdOrCtrl");
  if (e.shiftKey) parts.push("Shift");
  if (e.altKey) parts.push("Alt");

  // Need at least one "real" modifier (Cmd/Ctrl or Alt). Shift alone is not a
  // usable global shortcut, so reject Shift-only combos.
  const hasRealModifier = e.ctrlKey || e.metaKey || e.altKey;
  if (!hasRealModifier) return null;

  parts.push(main);
  return parts.join("+");
}

/** Per-token display symbols for a compact, readable rendering. */
const DISPLAY_TOKENS: Readonly<Record<string, string>> = {
  CmdOrCtrl: "⌘",
  Cmd: "⌘",
  Command: "⌘",
  Ctrl: "⌃",
  Control: "⌃",
  Shift: "⇧",
  Alt: "⌥",
  Option: "⌥",
};

/**
 * Render an accelerator for display, mapping modifier tokens to symbols and
 * joining without separators (e.g. `CmdOrCtrl+Shift+S` -> `⌘⇧S`). Unknown
 * tokens (the main key) pass through uppercased.
 */
export function formatAccelerator(accel: string): string {
  return accel
    .split("+")
    .map((token) => DISPLAY_TOKENS[token] ?? token.toUpperCase())
    .join("");
}
