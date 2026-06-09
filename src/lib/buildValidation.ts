// Pure validation + normalization for the build editor. The editor holds form
// fields as strings (time/leadTime) while the user types; this helper is
// the single boundary that turns a draft into a validated, normalized
// `BuildOrder` ready to persist — or an error message to show. Per the cross-
// layer guide, validation happens once, here, before crossing into Rust.

import type { BuildOrder, BuildStep, RecurringCue } from "../types/build";
import { parseClockTime } from "./clockTime";

/** A step as held by the editor form (numbers kept as raw strings). */
export interface DraftStep {
  time: string;
  say: string;
  /** Optional spoken override (empty string = unset). */
  sayAs: string;
}

/**
 * A recurring discipline reminder as held by the editor form (numbers kept as
 * raw strings; `endSec`/`sayAs` empty string = unset).
 */
export interface DraftRecurring {
  startSec: string;
  intervalSec: string;
  /** Optional last displayTime (empty string = until game end). */
  endSec: string;
  say: string;
  /** Optional spoken override (empty string = unset). */
  sayAs: string;
}

/** A build as held by the editor form. */
export interface DraftBuild {
  matchup: string;
  race: string;
  name: string;
  leadTimeSec: string;
  steps: DraftStep[];
  recurring: DraftRecurring[];
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
 * - each recurring cue: `say` required, `startSec`/`intervalSec` valid clock
 *   times (interval > 0), optional `endSec` >= `startSec`. Recurring order is
 *   preserved (parallel timers have no single ordering).
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

    const time = parseClockTime(draftStep.time);
    if (time === null) {
      return { ok: false, error: `${label}的时间格式应为 秒 或 mm:ss` };
    }

    const sayAs = draftStep.sayAs.trim();
    steps.push(sayAs === "" ? { time, say } : { time, say, sayAs });
  }

  // Auto-sort ascending by time (stable) so entry order doesn't matter.
  const sorted = [...steps].sort((a, b) => a.time - b.time);

  // Recurring cues: validated after steps, order preserved (parallel timers).
  const recurring: RecurringCue[] = [];
  for (let i = 0; i < draft.recurring.length; i++) {
    const draftCue = draft.recurring[i];
    const label = `第 ${i + 1} 条循环提醒`;

    const say = draftCue.say.trim();
    if (say === "") return { ok: false, error: `${label}的语音内容不能为空` };

    const startSec = parseClockTime(draftCue.startSec);
    if (startSec === null) {
      return { ok: false, error: `${label}的起始时间格式应为 秒 或 mm:ss` };
    }

    const intervalSec = parseClockTime(draftCue.intervalSec);
    if (intervalSec === null || intervalSec <= 0) {
      return { ok: false, error: `${label}的间隔必须大于 0` };
    }

    const rawEnd = draftCue.endSec.trim();
    let endSec: number | undefined;
    if (rawEnd !== "") {
      const parsedEnd = parseClockTime(draftCue.endSec);
      if (parsedEnd === null) {
        return { ok: false, error: `${label}的结束时间格式应为 秒 或 mm:ss` };
      }
      if (parsedEnd < startSec) {
        return { ok: false, error: `${label}的结束时间不能早于起始时间` };
      }
      endSec = parsedEnd;
    }

    const sayAs = draftCue.sayAs.trim();
    recurring.push({
      startSec,
      intervalSec,
      say,
      ...(endSec !== undefined ? { endSec } : {}),
      ...(sayAs === "" ? {} : { sayAs }),
    });
  }

  return {
    ok: true,
    build: {
      matchup,
      race,
      name,
      leadTimeSec,
      steps: sorted,
      ...(recurring.length ? { recurring } : {}),
    },
  };
}
