import { useEffect, useRef, useState } from "react";
import type { GameSnapshot } from "../types/sc2";
import { interpolate } from "../lib/clock";

/** How often (ms) we re-render the interpolated value. ~100ms granularity. */
const TICK_MS = 100;

/** A live game we should interpolate: in a real (non-replay) match. */
function isLiveGame(snapshot: GameSnapshot): boolean {
  return snapshot.connected && snapshot.in_game && !snapshot.is_replay;
}

/** Mutable anchor used to interpolate between ~1Hz polls. */
interface Anchor {
  /** True in-game time at the last re-anchor. */
  displayTime: number;
  /** `performance.now()` captured at the last re-anchor. */
  atMs: number;
  /** Whether the game appears paused/stalled (display_time not progressing). */
  paused: boolean;
}

/**
 * Smoothly-advancing in-game clock. Re-anchors on every snapshot whose
 * `display_time` changes, advances via the local wall clock between polls, and
 * freezes when the game is paused/stalled or not live. StrictMode-safe: the
 * tick interval is cleared on unmount and never leaked across remounts.
 */
export function useInterpolatedClock(snapshot: GameSnapshot): number {
  // Anchor + last-seen display_time. Refs so the tick reads fresh values
  // without re-subscribing the interval on every snapshot.
  const anchorRef = useRef<Anchor>({
    displayTime: snapshot.display_time,
    atMs: 0,
    paused: true,
  });
  const prevDisplayTimeRef = useRef<number | null>(null);

  const [current, setCurrent] = useState<number>(snapshot.display_time);

  // Update the anchor whenever a new snapshot arrives.
  useEffect(() => {
    if (!isLiveGame(snapshot)) {
      // Not live: track the raw idle value and reset so the next game is clean.
      anchorRef.current = {
        displayTime: snapshot.display_time,
        atMs: performance.now(),
        paused: true,
      };
      prevDisplayTimeRef.current = null;
      setCurrent(snapshot.display_time);
      return;
    }

    const prev = prevDisplayTimeRef.current;
    prevDisplayTimeRef.current = snapshot.display_time;

    if (prev !== null && snapshot.display_time === prev) {
      // No progress across polls: pause/loading. Freeze at the existing anchor
      // (do NOT re-anchor to a moving `now`, which would chase wall time).
      anchorRef.current = { ...anchorRef.current, paused: true };
      setCurrent(anchorRef.current.displayTime);
      return;
    }

    // display_time advanced (or first live snapshot): re-anchor to true time.
    anchorRef.current = {
      displayTime: snapshot.display_time,
      atMs: performance.now(),
      paused: false,
    };
    setCurrent(snapshot.display_time);
  }, [snapshot]);

  // Tick the interpolated value between polls. Subscribed once per mount.
  useEffect(() => {
    const id = setInterval(() => {
      const anchor = anchorRef.current;
      setCurrent(
        interpolate({
          anchorDisplayTime: anchor.displayTime,
          anchorAtMs: anchor.atMs,
          nowMs: performance.now(),
          paused: anchor.paused,
        }),
      );
    }, TICK_MS);

    return () => clearInterval(id);
  }, []);

  return current;
}
