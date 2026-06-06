// Pure supply→time helper for the build editor. SC2 builds are normally
// remembered by supply count (e.g. "14 depot"); the scheduler needs an in-game
// clock time (seconds). This gives a rough linear estimate the user fine-tunes.
//
// Model (simple linear, Terran defaults): a worker/supply is produced roughly
// every `SECONDS_PER_SUPPLY` seconds from a single base, starting at
// `START_SUPPLY`. This is intentionally approximate — production rate changes
// with worker count and expansions — so the editor only seeds a suggested time.

/** Supply the local player starts the game at (Terran: 12 SCVs). */
export const START_SUPPLY = 12;

/** Rough seconds per additional supply at one production base. */
export const SECONDS_PER_SUPPLY = 12;

/**
 * Estimate the in-game-clock time (seconds) at which a given supply count is
 * reached, using a simple linear model. Supply at or below the starting supply
 * maps to time 0. Returns a whole number of seconds (rounded).
 */
export function supplyToTime(supply: number): number {
  if (!Number.isFinite(supply)) return 0;
  const delta = supply - START_SUPPLY;
  if (delta <= 0) return 0;
  return Math.round(delta * SECONDS_PER_SUPPLY);
}
