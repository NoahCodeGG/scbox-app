// Pure helpers that turn a build step's display text into what TTS should read.
// Display (`say`) uses terse shorthand (`火车 x2`, `注卵.菌毯`) that reads badly
// aloud, so a step may carry an optional `sayAs` override; when absent we apply
// a light `humanize` pass. Display text is never altered — only what is spoken.

import type { BuildStep } from "../types/build";

/**
 * Lightly rewrite display shorthand into something TTS reads naturally:
 * - `xN` (N digits) → `N个` so it isn't read as the English letter "x".
 * - `.` (action separator) → a space, i.e. a spoken pause.
 * Other characters are left as-is; collapses runs of whitespace and trims.
 */
export function humanize(text: string): string {
  return text
    .replace(/x(\d+)/g, "$1个")
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The text TTS should speak for a step: the `sayAs` override when set
 * (non-empty after trim, read verbatim), otherwise `humanize(say)`.
 */
export function spokenText(step: BuildStep): string {
  const sayAs = step.sayAs?.trim();
  if (sayAs) return sayAs;
  return humanize(step.say);
}
