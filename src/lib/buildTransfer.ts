// Pure helpers for sharing build orders as portable JSON text (import/export).
// Export produces clean, filename-free `BuildOrder` JSON; import parses untrusted
// text and routes it through the SAME `validateBuild` boundary as the editor so
// imported builds can never corrupt the builds dir. No Tauri plugin, no backend
// change — transport is plain clipboard/text JSON (see the task PRD, Q1–Q3).

import { validateBuild, type DraftBuild, type DraftStep } from "./buildValidation";
import type { BuildOrder, BuildStep } from "../types/build";

/** Result of parsing imported text — mirrors `validateBuild`'s shape. */
export type ImportResult =
  | { ok: true; build: BuildOrder }
  | { ok: false; error: string };

/**
 * Serialize a build to pretty (2-space) JSON containing exactly the on-disk
 * contract fields — matchup, race, leadTimeSec, and each step's time/say (plus
 * supply only when defined). Never leaks loader metadata such as `filename`.
 */
export function exportBuildJson(build: BuildOrder): string {
  const clean = {
    matchup: build.matchup,
    race: build.race,
    leadTimeSec: build.leadTimeSec,
    steps: build.steps.map((step) => {
      const out: BuildStep = { time: step.time, say: step.say };
      if (step.supply !== undefined) out.supply = step.supply;
      return out;
    }),
  };
  return JSON.stringify(clean, null, 2);
}

/** True for a non-null, non-array object value. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Coerce an unknown scalar field into the editor's string draft form. */
function toFieldString(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  // Objects/arrays in a scalar slot are invalid; pass through a marker that
  // validateBuild will reject (e.g. NaN for numeric fields, non-empty for text).
  return String(value);
}

/** Coerce one parsed step object into a `DraftStep` (strings only). */
function toDraftStep(value: unknown): DraftStep {
  const obj = isPlainObject(value) ? value : {};
  return {
    time: toFieldString(obj.time),
    say: toFieldString(obj.say),
    supply: toFieldString(obj.supply),
  };
}

/**
 * Parse untrusted shared text into a validated `BuildOrder`:
 * 1. JSON.parse (guarded).
 * 2. Require a non-null plain object.
 * 3. If `steps` is present it must be an array (missing → treated as empty).
 * 4. Coerce fields to a `DraftBuild` and delegate to `validateBuild`, reusing
 *    every existing rule (required matchup/race, numeric/non-negative time,
 *    supply checks, ascending sort).
 */
export function parseImportedBuild(text: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e: unknown) {
    const reason = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `JSON 解析失败：${reason}` };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: "格式不是有效的建造顺序对象" };
  }

  const rawSteps = parsed.steps;
  if (rawSteps !== undefined && !Array.isArray(rawSteps)) {
    return { ok: false, error: "steps 必须是数组" };
  }

  const draft: DraftBuild = {
    matchup: toFieldString(parsed.matchup),
    race: toFieldString(parsed.race),
    leadTimeSec: toFieldString(parsed.leadTimeSec),
    steps: (rawSteps ?? []).map(toDraftStep),
  };

  return validateBuild(draft);
}
