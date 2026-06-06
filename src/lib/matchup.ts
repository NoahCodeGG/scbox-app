// Pure matchup logic: identify the local player and opponent races from a game
// snapshot, and select the build order that fits the detected matchup. Kept
// DOM-free and side-effect-free so it is fully unit-testable.

import type { BuildOrder } from "../types/build";
import type { PlayerInfo } from "../types/sc2";

/** Single-letter race code used in matchup strings. `X` means "any". */
export type RaceLetter = "T" | "P" | "Z" | "X";

/** Detected matchup: who "me" is, plus both race letters. */
export interface DetectedMatchup {
  /** `PlayerInfo.id` of the player treated as "me". */
  meId: number;
  /** My race letter. */
  myRace: RaceLetter;
  /** Opponent race letter; `X` when it can't be determined. */
  oppRace: RaceLetter;
}

/** Both sides of a parsed `"<mine>v<opp>"` matchup string. */
export interface ParsedMatchup {
  mine: RaceLetter;
  opp: RaceLetter;
}

const RACE_CODE_TO_LETTER: Record<string, RaceLetter> = {
  Terr: "T",
  Prot: "P",
  Zerg: "Z",
};

/**
 * Map the SC2 API's short race code to a single matchup letter. Anything not
 * explicitly mapped (including `"random"`) becomes `X` — no specific race is
 * known at load time.
 */
export function raceCodeToLetter(code: string): RaceLetter {
  return RACE_CODE_TO_LETTER[code] ?? "X";
}

/** Whether a string is one of the four valid race letters. */
function isRaceLetter(value: string): value is RaceLetter {
  return value === "T" || value === "P" || value === "Z" || value === "X";
}

const RACE_NAME_TO_LETTER: Record<string, RaceLetter> = {
  Terran: "T",
  Protoss: "P",
  Zerg: "Z",
};

/**
 * Map a readable race name (as stored in `BuildOrder.race`, e.g. `"Terran"`) to
 * its matchup letter. Anything unrecognized (including "Random"/"Any") becomes
 * `X`. Used by the editor's race/opponent dropdowns to compose a `matchup`.
 */
export function raceNameToLetter(name: string): RaceLetter {
  return RACE_NAME_TO_LETTER[name.trim()] ?? "X";
}

/**
 * Parse a build's `matchup` string (`"<mine>v<opp>"`, e.g. `"TvP"`, `"TvX"`)
 * into its two race letters. Tolerates upper/lowercase `v`/`V`. Returns null
 * when the shape or letters are invalid.
 */
export function parseMatchup(matchup: string): ParsedMatchup | null {
  const parts = matchup.split(/[vV]/);
  if (parts.length !== 2) return null;

  const mine = parts[0].trim().toUpperCase();
  const opp = parts[1].trim().toUpperCase();
  if (!isRaceLetter(mine) || !isRaceLetter(opp)) return null;

  return { mine, opp };
}

/**
 * Identify "me" and the opponent from a snapshot's players.
 *
 * "Me" is the first `type:"user"` player (the SC2 API lists the local player
 * first), falling back to the first player when no user is present. The
 * opponent is the other player in a 2-player game; with 3+ players the specific
 * opponent is undetermined so `oppRace` is `X`.
 *
 * Returns null when fewer than two players are present (no matchup to detect).
 */
export function identifyMatchup(
  players: readonly PlayerInfo[],
): DetectedMatchup | null {
  if (players.length < 2) return null;

  const me = resolveMe(players);
  const myRace = raceCodeToLetter(me.race);

  // Specific opponent only known in a clean 2-player game.
  if (players.length === 2) {
    const opponent = players.find((p) => p.id !== me.id);
    const oppRace = opponent ? raceCodeToLetter(opponent.race) : "X";
    return { meId: me.id, myRace, oppRace };
  }

  return { meId: me.id, myRace, oppRace: "X" };
}

/** Pick the player treated as "me": the first user, else the first player. */
function resolveMe(players: readonly PlayerInfo[]): PlayerInfo {
  return players.find((p) => p.type === "user") ?? players[0];
}

/**
 * Select the build order to coach with for the detected matchup.
 *
 * Among builds whose parsed `mine` letter equals `myRace`, prefer an exact
 * opponent match (`opp === oppRace`), then a `...vX` catch-all. If no build
 * targets my race at all, fall back to the first loaded build. Empty input
 * yields null (the caller substitutes the bundled fallback).
 */
export function selectBuild(
  builds: readonly BuildOrder[],
  myRace: RaceLetter,
  oppRace: RaceLetter,
): BuildOrder | null {
  if (builds.length === 0) return null;

  const mine = builds.filter((b) => {
    const parsed = parseMatchup(b.matchup);
    return parsed?.mine === myRace;
  });

  if (mine.length === 0) return builds[0];

  const exact = mine.find((b) => parseMatchup(b.matchup)?.opp === oppRace);
  if (exact) return exact;

  const catchAll = mine.find((b) => parseMatchup(b.matchup)?.opp === "X");
  if (catchAll) return catchAll;

  return mine[0];
}
