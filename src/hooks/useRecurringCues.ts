import { useEffect, useMemo, useRef } from "react";
import type { BuildOrder, RecurringCue } from "../types/build";
import type { GameSnapshot } from "../types/sc2";
import { cancelAll, speak } from "../lib/speech";
import { spokenTextFor } from "../lib/sayVoice";
import { lastDueOccurrence, nextRecurringTargetTime } from "../lib/schedule";

/** A backwards jump in the in-game clock larger than this (seconds) means a new
 *  match started while we never left the live state. Kept in sync with the same
 *  constant in useBuildOrderVoice so both reset on a fast rematch. */
const RESTART_BACKSTEP_SEC = 5;

/** Per-rule UI state surfaced for the discipline-timer row. */
export interface RecurringCueState {
  /** UI text (from `cue.say`). */
  say: string;
  /**
   * Target in-game clock (displayTime, seconds) of the next occurrence, or
   * `null` when there is none (past `endSec`, invalid cue, or not live).
   */
  nextTargetTime: number | null;
}

/**
 * Voice knobs for recurring cues. `voiceEnabled` is the independent recurring
 * voice toggle (`settings.recurringVoiceEnabled`); `voiceRate` reuses the build
 * voice rate; `leadTimeSecOverride` matches build-order scheduling (replaces the
 * build's own `leadTimeSec` when set).
 */
export interface RecurringOptions {
  voiceEnabled: boolean;
  voiceRate: number;
  leadTimeSecOverride: number | null;
}

/** A live game we should be guiding: in a real (non-replay) match. */
function isLiveGame(snapshot: GameSnapshot): boolean {
  return snapshot.in_game && !snapshot.is_replay;
}

/**
 * Drives recurring discipline cues (e.g. Zerg inject/creep) against the live
 * game clock, in parallel with the linear build order. Each cue fires every
 * `intervalSec` from `startSec` (optionally stopping at `endSec`), reusing the
 * build's announce-ahead (`leadTimeSec`, with the user's override applied).
 *
 * Mirrors useBuildOrderVoice's lifecycle: it gates on live/replay, suppresses a
 * late-connect backlog (occurrences already past on the first live frame are
 * marked spoken, not re-announced), resets on game end/replay, and re-seeds on a
 * fast rematch (a large backwards clock jump). The recurring voice toggle is
 * independent of build voice: when off, no audio fires but `nextTargetTime`
 * countdowns are still returned for the UI.
 *
 * Pure scheduling lives in schedule.ts; this hook only owns side effects and the
 * per-cue "last announced occurrence" refs.
 */
export function useRecurringCues(
  snapshot: GameSnapshot,
  order: BuildOrder,
  currentTime: number,
  options: RecurringOptions,
): RecurringCueState[] {
  const { voiceEnabled, voiceRate, leadTimeSecOverride } = options;

  // The cue list and effective lead time, memoized so the effect's deps are
  // stable across renders that don't change the order or the override.
  const cues = useMemo<RecurringCue[]>(
    () => order.recurring ?? [],
    [order],
  );
  const leadTimeSec = useMemo(
    () => (leadTimeSecOverride === null ? order.leadTimeSec : leadTimeSecOverride),
    [order.leadTimeSec, leadTimeSecOverride],
  );

  // Last announced occurrence index per cue (keyed by array index). -1 means
  // "nothing announced yet". Mutated in place via the ref; never leaked.
  const announcedRef = useRef<number[]>([]);
  // Tracks whether we are mid-game so we only seed once per game.
  const activeRef = useRef(false);
  // Last in-game clock seen while live; a large backwards jump = new match.
  const lastTimeRef = useRef(0);

  // Re-seed the per-cue tracking array if the cue count changes (e.g. a
  // different build loaded). Done in render so the effect always sees a
  // correctly-sized array; it's an idempotent length sync, not a side effect.
  if (announcedRef.current.length !== cues.length) {
    announcedRef.current = cues.map(() => -1);
  }

  // Returned per-cue UI state is recomputed from the live clock on every render.
  // The parent re-renders ~10x/sec as `currentTime` advances (useInterpolated
  // clock), so the countdown stays fresh without any local state here — the
  // effect below only owns side effects (speech) and the per-cue tracking refs.

  useEffect(() => {
    const live = isLiveGame(snapshot);

    if (cues.length === 0) {
      // No recurring rules: nothing to schedule, and nothing to reset.
      return;
    }

    if (!live) {
      // Game end / replay / idle: reset and silence for a clean next game.
      if (activeRef.current) {
        activeRef.current = false;
        announcedRef.current = cues.map(() => -1);
        cancelAll();
      }
      lastTimeRef.current = 0;
      return;
    }

    // New match while staying live: the clock jumped backwards past any jitter.
    const restarted =
      activeRef.current &&
      currentTime < lastTimeRef.current - RESTART_BACKSTEP_SEC;

    if (!activeRef.current || restarted) {
      // First live frame (or fresh match): mark every occurrence already due as
      // announced so a late connect / rematch doesn't replay the backlog.
      activeRef.current = true;
      if (restarted) cancelAll();
      announcedRef.current = cues.map((cue) =>
        lastDueOccurrence(cue, currentTime, leadTimeSec) ?? -1,
      );
      lastTimeRef.current = currentTime;
      return;
    }

    lastTimeRef.current = currentTime;

    // Announce any newly-due occurrences for each cue (one speak per occurrence).
    cues.forEach((cue, i) => {
      const last = lastDueOccurrence(cue, currentTime, leadTimeSec);
      if (last === null) return;
      const announced = announcedRef.current[i] ?? -1;
      if (last <= announced) return;
      if (voiceEnabled) {
        const text = spokenTextFor(cue.say, cue.sayAs);
        for (let k = announced + 1; k <= last; k += 1) {
          speak(text, voiceRate);
        }
      }
      announcedRef.current[i] = last;
    });
  }, [snapshot, cues, currentTime, leadTimeSec, voiceEnabled, voiceRate]);

  // Cancel any in-flight speech if the component unmounts entirely.
  useEffect(() => () => cancelAll(), []);

  const live = isLiveGame(snapshot);
  return cues.map((cue) => ({
    say: cue.say,
    nextTargetTime: live
      ? nextRecurringTargetTime(cue, currentTime, leadTimeSec)
      : null,
  }));
}
