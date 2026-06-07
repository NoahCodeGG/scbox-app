// Pure validation + normalization for the build editor. The editor holds form
// fields as strings (time/leadTime) while the user types; this helper is
// the single boundary that turns a draft into a validated, normalized
// `BuildOrder` ready to persist — or an error message to show. Per the cross-
// layer guide, validation happens once, here, before crossing into Rust.

import type { BuildOrder, BuildStep } from "../types/build";

/** A step as held by the editor form (numbers kept as raw strings). */
export interface DraftStep {
  time: string;
  say: string;
}

/** A build as held by the editor form. */
export interface DraftBuild {
  matchup: string;
  race: string;
  name: string;
  leadTimeSec: string;
  steps: DraftStep[];
}

/** Discriminated result of validating a draft build. */
export type ValidationResult =
  | { ok: true; build: BuildOrder }
  | { ok: false; error: string };

/** Parse a required non-negative number field, or return an error message. */
function parseNonNegative(raw: string, label: string): number | string {
  const trimmed = raw.trim();
  if (trimmed === "") return `${label}不能为空`;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return `${label}必须是数字`;
  if (value < 0) return `${label}不能为负数`;
  return value;
}

/**
 * Validate and normalize a draft build:
 * - `matchup` / `race` / `name` required (trimmed).
 * - `leadTimeSec` a non-negative number.
 * - each step: `say` required, `time` a non-negative number.
 * - steps sorted ascending by `time` (the scheduler expects ascending order).
 *
 * Returns the normalized `BuildOrder` on success, or the first error found.
 */
export function validateBuild(draft: DraftBuild): ValidationResult {
  const matchup = draft.matchup.trim();
  if (matchup === "") return { ok: false, error: "对阵 (matchup) 不能为空" };

  const race = draft.race.trim();
  if (race === "") return { ok: false, error: "种族 (race) 不能为空" };

  const name = draft.name.trim();
  if (name === "") return { ok: false, error: "名称 (name) 不能为空" };

  const leadTimeSec = parseNonNegative(draft.leadTimeSec, "提前播报秒数");
  if (typeof leadTimeSec === "string") {
    return { ok: false, error: leadTimeSec };
  }

  const steps: BuildStep[] = [];
  for (let i = 0; i < draft.steps.length; i++) {
    const draftStep = draft.steps[i];
    const label = `第 ${i + 1} 步`;

    const say = draftStep.say.trim();
    if (say === "") return { ok: false, error: `${label}的语音内容不能为空` };

    const time = parseNonNegative(draftStep.time, `${label}的时间`);
    if (typeof time === "string") return { ok: false, error: time };

    steps.push({ time, say });
  }

  // Auto-sort ascending by time (stable) so entry order doesn't matter.
  const sorted = [...steps].sort((a, b) => a.time - b.time);

  return { ok: true, build: { matchup, race, name, leadTimeSec, steps: sorted } };
}
