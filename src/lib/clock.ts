// Pure interpolation logic for the in-game clock. No side effects — given an
// anchor (true in-game time + the wall-clock instant it was sampled) and the
// current wall-clock instant, estimate the current in-game time between polls.
// Unit-tested in clock.test.ts.

/** Inputs for a single interpolation sample. */
export interface InterpolateArgs {
  /** The true in-game `display_time` at the last re-anchor. */
  anchorDisplayTime: number;
  /** `performance.now()` value captured at the last re-anchor. */
  anchorAtMs: number;
  /** The current `performance.now()` value. */
  nowMs: number;
  /** When true (paused/stalled game), freeze at the anchor. */
  paused: boolean;
}

/**
 * Interpolated in-game time. Returns the anchor when paused or when no wall
 * time has elapsed since the anchor; otherwise advances the anchor by the
 * elapsed wall seconds. Never returns less than the anchor.
 */
export function interpolate(args: InterpolateArgs): number {
  const { anchorDisplayTime, anchorAtMs, nowMs, paused } = args;
  if (paused || nowMs <= anchorAtMs) {
    return anchorDisplayTime;
  }
  return anchorDisplayTime + (nowMs - anchorAtMs) / 1000;
}
