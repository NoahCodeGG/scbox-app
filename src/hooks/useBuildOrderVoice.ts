import { useEffect, useMemo, useRef, useState } from "react";
import type { BuildOrder, BuildStep } from "../types/build";
import type { GameSnapshot } from "../types/sc2";
import { cancelAll, speak } from "../lib/speech";
import { spokenText } from "../lib/sayVoice";
import {
  dueStepIndices,
  nextStepIndex,
  previewSpokenSet,
} from "../lib/schedule";

/** A backwards jump in the in-game clock larger than this (seconds) means a new
 *  match started while we never left the live state (fast rematch, or a debounced
 *  reconnect that held the live snapshot). Real play only moves forward. */
const RESTART_BACKSTEP_SEC = 5;

/** UI state surfaced by the build-order voice hook. */
export interface BuildOrderVoiceState {
  /** Next upcoming (not-yet-spoken) step, or null when finished/idle. */
  nextStep: BuildStep | null;
  /** Count of steps already spoken (or suppressed) this game. */
  spokenCount: number;
  /** Readonly view of the spoken-step indices. */
  spoken: ReadonlySet<number>;
}

/**
 * Voice knobs from user settings. `leadTimeSecOverride` (when not null) replaces
 * each build's own `leadTimeSec` for scheduling and the countdown; `voiceEnabled`
 * gates audio; `voiceRate` is passed to the Web Speech utterance.
 */
export interface VoiceOptions {
  voiceEnabled: boolean;
  voiceRate: number;
  leadTimeSecOverride: number | null;
}

/** A live game we should be guiding: in a real (non-replay) match. */
function isLiveGame(snapshot: GameSnapshot): boolean {
  return snapshot.in_game && !snapshot.is_replay;
}

/**
 * The build order to schedule against, with the user's lead-time override
 * applied when set. Returns the original order untouched when the override is
 * null (use each build's own `leadTimeSec`).
 */
export function effectiveOrder(
  order: BuildOrder,
  leadTimeSecOverride: number | null,
): BuildOrder {
  if (leadTimeSecOverride === null) return order;
  return { ...order, leadTimeSec: leadTimeSecOverride };
}

/**
 * Drives announce-ahead voice cues for one build order against the live game
 * clock. Owns spoken-index state immutably, suppresses a late-connect backlog,
 * and cancels/resets speech on game end or replay.
 *
 * `currentTime` is the interpolated in-game clock (see useInterpolatedClock);
 * cues are scheduled off it so they fire within ~100ms of `time - leadTimeSec`
 * rather than up to ~1s late. `snapshot` is still used for live/replay/result
 * gating only.
 */
export function useBuildOrderVoice(
  snapshot: GameSnapshot,
  order: BuildOrder,
  currentTime: number,
  options: VoiceOptions,
): BuildOrderVoiceState {
  const { voiceEnabled, voiceRate, leadTimeSecOverride } = options;
  // The order whose `leadTimeSec` reflects the user's override (or the build's
  // own value when null). Memoized so the effect's dependency is stable across
  // renders that don't change the order or the override.
  const scheduledOrder = useMemo(
    () => effectiveOrder(order, leadTimeSecOverride),
    [order, leadTimeSecOverride],
  );

  const [spoken, setSpoken] = useState<Set<number>>(() => new Set());
  // Tracks whether we are mid-game so we only seed the spoken set once per game.
  const activeRef = useRef(false);
  // StrictMode guard: indices already passed to `speak` in this mounted
  // lifetime, so a dev double-invoke of the effect cannot double-speak.
  const spokenGuardRef = useRef<Set<number>>(new Set());
  // Last in-game clock seen while live. A large backwards jump means a new
  // match started without ever leaving the live state (see RESTART_BACKSTEP_SEC).
  const lastTimeRef = useRef(0);

  useEffect(() => {
    const live = isLiveGame(snapshot);

    if (!live) {
      // Game end / replay / idle: reset and silence for a clean next game.
      if (activeRef.current) {
        activeRef.current = false;
        spokenGuardRef.current = new Set();
        cancelAll();
        setSpoken(new Set());
      }
      lastTimeRef.current = 0;
      return;
    }

    // New match while staying live: the in-game clock jumped backwards well past
    // any interpolation jitter, so reset and re-seed from scratch.
    const restarted =
      activeRef.current && currentTime < lastTimeRef.current - RESTART_BACKSTEP_SEC;

    if (!activeRef.current || restarted) {
      // First live snapshot (or a fresh match): suppress steps whose trigger
      // time already passed; previewSpokenSet returns empty at t<=0 so an
      // opening (time-0) step is not wrongly pre-marked as spoken.
      activeRef.current = true;
      if (restarted) cancelAll();
      const seeded = previewSpokenSet(scheduledOrder, currentTime);
      spokenGuardRef.current = new Set(seeded);
      setSpoken(seeded);
      lastTimeRef.current = currentTime;
      return;
    }

    lastTimeRef.current = currentTime;

    const due = dueStepIndices(scheduledOrder, currentTime, spoken);
    const toSpeak = due.filter((i) => !spokenGuardRef.current.has(i));
    if (toSpeak.length === 0) return;

    for (const i of toSpeak) {
      spokenGuardRef.current.add(i);
      // Voice off: still advance the spoken set (so the next-step display and
      // countdown progress), just skip the audio.
      if (voiceEnabled) speak(spokenText(scheduledOrder.steps[i]), voiceRate);
    }
    setSpoken((prev) => {
      const next = new Set(prev);
      for (const i of toSpeak) next.add(i);
      return next;
    });
  }, [snapshot, scheduledOrder, spoken, currentTime, voiceEnabled, voiceRate]);

  // Cancel any in-flight speech if the component unmounts entirely.
  useEffect(() => () => cancelAll(), []);

  const nextIndex = nextStepIndex(scheduledOrder, spoken);
  return {
    nextStep: nextIndex === null ? null : scheduledOrder.steps[nextIndex],
    spokenCount: spoken.size,
    spoken,
  };
}
