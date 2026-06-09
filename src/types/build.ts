// Shape of a hand-edited build-order JSON file. Steps are keyed to the SC2
// in-game clock (`displayTime`, seconds). The assistant speaks each step's
// `say` text `leadTimeSec` seconds before its `time`.

/** A single build-order cue keyed to the in-game clock. */
export interface BuildStep {
  /** Target `displayTime` (seconds) for the action. */
  time: number;
  /** Text shown in the UI when the step is due. */
  say: string;
  /**
   * Optional spoken override. When non-empty it is read verbatim by TTS instead
   * of `say`; absent/empty falls back to `humanize(say)`. Lets authors phrase a
   * cue for the ear (e.g. `say` is `"火车 x2"` while `sayAs` is `"造两辆火车"`).
   */
  sayAs?: string;
}

/**
 * A recurring discipline reminder (e.g. Zerg inject/creep): fires every
 * intervalSec starting at startSec, optionally stopping at endSec. Independent
 * of the linear build steps.
 */
export interface RecurringCue {
  /** First trigger's target displayTime (seconds). */
  startSec: number;
  /** Seconds between repeats (must be > 0). */
  intervalSec: number;
  /** Optional last displayTime to keep firing through; omitted = until game end. */
  endSec?: number;
  /** Text shown in the UI when due. */
  say: string;
  /** Optional spoken override (verbatim TTS); same semantics as BuildStep.sayAs. */
  sayAs?: string;
}

/** A full build order for one matchup. */
export interface BuildOrder {
  /** e.g. "TvP". Display/identification only in the MVP. */
  matchup: string;
  /** Player race this build is authored for, e.g. "Terran". */
  race: string;
  /**
   * Human-readable label, e.g. "TvZ 两船兵". May be empty for older files; the
   * UI falls back to `matchup` for display.
   */
  name: string;
  /** Seconds to announce a step ahead of its `time` (announce-ahead). */
  leadTimeSec: number;
  /** Cues in (expected) ascending `time` order. */
  steps: BuildStep[];
  /**
   * Parallel recurring discipline reminders (e.g. inject/creep) that run
   * independently of `steps`. Absent/empty means there are none.
   */
  recurring?: RecurringCue[];
}

/**
 * Result of the Rust `load_build_orders` command. Mirrors the serde
 * `LoadResult` struct in `src-tauri/src/builds.rs` (camelCase keys). `builds`
 * holds every successfully parsed file paired with its source filename;
 * `errors` holds one `"<file>: <reason>"` string per file that failed to parse.
 */
export interface LoadResult {
  builds: StoredBuild[];
  errors: string[];
}

/**
 * A loaded build paired with the name of the file it came from. The filename is
 * loader metadata (not part of the on-disk JSON) so the editor can save/delete
 * the right file. Mirrors `StoredBuild` in `src-tauri/src/builds.rs`.
 */
export interface StoredBuild {
  /** Source filename within the app-data `builds/` dir, e.g. `"tvp.json"`. */
  filename: string;
  /** The parsed build order. */
  build: BuildOrder;
  /**
   * True for embedded defaults (read-only, cannot be saved/deleted in place);
   * false for user files under the app-data builds dir.
   */
  readOnly: boolean;
}
