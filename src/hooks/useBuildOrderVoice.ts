import { useEffect, useRef, useState } from "react";
import type { BuildOrder, BuildStep } from "../types/build";
import type { GameSnapshot } from "../types/sc2";
import { cancelAll, speak } from "../lib/speech";
import {
  dueStepIndices,
  initialSpokenSet,
  nextStepIndex,
} from "../lib/schedule";

/** UI state surfaced by the build-order voice hook. */
export interface BuildOrderVoiceState {
  /** Next upcoming (not-yet-spoken) step, or null when finished/idle. */
  nextStep: BuildStep | null;
  /** Count of steps already spoken (or suppressed) this game. */
  spokenCount: number;
}

/** A live game we should be guiding: in a real (non-replay) match. */
function isLiveGame(snapshot: GameSnapshot): boolean {
  return snapshot.in_game && !snapshot.is_replay;
}

/** A player result has been decided (game over). */
function hasResult(snapshot: GameSnapshot): boolean {
  return snapshot.players.some(
    (p) => p.result !== "" && p.result !== "Undecided",
  );
}

/**
 * Drives announce-ahead voice cues for one build order against the live game
 * clock. Owns spoken-index state immutably, suppresses a late-connect backlog,
 * and cancels/resets speech on game end or replay.
 */
export function useBuildOrderVoice(
  snapshot: GameSnapshot,
  order: BuildOrder,
): BuildOrderVoiceState {
  const [spoken, setSpoken] = useState<Set<number>>(() => new Set());
  // Tracks whether we are mid-game so we only seed the spoken set once per game.
  const activeRef = useRef(false);
  // StrictMode guard: indices already passed to `speak` in this mounted
  // lifetime, so a dev double-invoke of the effect cannot double-speak.
  const spokenGuardRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const live = isLiveGame(snapshot) && !hasResult(snapshot);

    if (!live) {
      // Game end / replay / idle: reset and silence for a clean next game.
      if (activeRef.current) {
        activeRef.current = false;
        spokenGuardRef.current = new Set();
        cancelAll();
        setSpoken(new Set());
      }
      return;
    }

    if (!activeRef.current) {
      // First live snapshot: suppress steps whose trigger time already passed.
      activeRef.current = true;
      const seeded = initialSpokenSet(order, snapshot.display_time);
      spokenGuardRef.current = new Set(seeded);
      setSpoken(seeded);
      return;
    }

    const due = dueStepIndices(order, snapshot.display_time, spoken);
    const toSpeak = due.filter((i) => !spokenGuardRef.current.has(i));
    if (toSpeak.length === 0) return;

    for (const i of toSpeak) {
      spokenGuardRef.current.add(i);
      speak(order.steps[i].say);
    }
    setSpoken((prev) => {
      const next = new Set(prev);
      for (const i of toSpeak) next.add(i);
      return next;
    });
  }, [snapshot, order, spoken]);

  // Cancel any in-flight speech if the component unmounts entirely.
  useEffect(() => () => cancelAll(), []);

  const nextIndex = nextStepIndex(order, spoken);
  return {
    nextStep: nextIndex === null ? null : order.steps[nextIndex],
    spokenCount: spoken.size,
  };
}
