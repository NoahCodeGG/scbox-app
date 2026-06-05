// Shape of a hand-edited build-order JSON file. Steps are keyed to the SC2
// in-game clock (`displayTime`, seconds). The assistant speaks each step's
// `say` text `leadTimeSec` seconds before its `time`.

/** A single build-order cue keyed to the in-game clock. */
export interface BuildStep {
  /** Target `displayTime` (seconds) for the action. */
  time: number;
  /** Text spoken via Web Speech when the step is due. */
  say: string;
}

/** A full build order for one matchup. */
export interface BuildOrder {
  /** e.g. "TvP". Display/identification only in the MVP. */
  matchup: string;
  /** Player race this build is authored for, e.g. "Terran". */
  race: string;
  /** Seconds to announce a step ahead of its `time` (announce-ahead). */
  leadTimeSec: number;
  /** Cues in (expected) ascending `time` order. */
  steps: BuildStep[];
}

/**
 * Result of the Rust `load_build_orders` command. Mirrors the serde
 * `LoadResult` struct in `src-tauri/src/builds.rs` (camelCase keys). `builds`
 * holds every successfully parsed file; `errors` holds one `"<file>: <reason>"`
 * string per file that failed to parse.
 */
export interface LoadResult {
  builds: BuildOrder[];
  errors: string[];
}
