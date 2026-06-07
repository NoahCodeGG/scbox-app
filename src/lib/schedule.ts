// Pure scheduling logic for build-order cues. No side effects — given the
// current in-game clock and a build order, decide which steps are now due.
// Unit-tested in schedule.test.ts.

import type { BuildOrder } from "../types/build";

/** The `displayTime` at which step `i` should be announced. */
export function triggerTime(order: BuildOrder, stepIndex: number): number {
  return order.steps[stepIndex].time - order.leadTimeSec;
}

/**
 * Indices of steps that are now due to be spoken: trigger time has passed and
 * the step has not been spoken yet. Returned ascending by index.
 */
export function dueStepIndices(
  order: BuildOrder,
  displayTime: number,
  spoken: ReadonlySet<number>,
): number[] {
  const due: number[] = [];
  for (let i = 0; i < order.steps.length; i += 1) {
    if (spoken.has(i)) continue;
    if (displayTime >= triggerTime(order, i)) {
      due.push(i);
    }
  }
  return due;
}

/**
 * Initial "already-spoken" set for a freshly-live game. Every step whose
 * trigger time is already <= the current clock is marked spoken so a
 * late-connect / mid-game start does not dump a backlog of cues.
 */
export function initialSpokenSet(
  order: BuildOrder,
  displayTime: number,
): Set<number> {
  const spoken = new Set<number>();
  for (let i = 0; i < order.steps.length; i += 1) {
    if (displayTime >= triggerTime(order, i)) {
      spoken.add(i);
    }
  }
  return spoken;
}

/**
 * "Already-spoken" set for the Dashboard step preview at the given display time.
 *
 * Short-circuits to an empty set when `displayTime <= 0` (game not started /
 * not connected): otherwise `initialSpokenSet` would pre-mark any step whose
 * trigger time (`time - leadTimeSec`) is non-positive — e.g. a time-0 step with
 * the default 4s lead computes `0 >= -4` and is wrongly treated as spoken, so
 * the preview would skip the opening step(s). Once the clock is running
 * (`displayTime > 0`) it defers to `initialSpokenSet` for normal behavior.
 */
export function previewSpokenSet(
  order: BuildOrder,
  displayTime: number,
): Set<number> {
  if (displayTime <= 0) return new Set<number>();
  return initialSpokenSet(order, displayTime);
}

/**
 * The next upcoming (not-yet-spoken) step's index, or `null` if all steps for
 * this order have been spoken. Returns the lowest such index.
 */
export function nextStepIndex(
  order: BuildOrder,
  spoken: ReadonlySet<number>,
): number | null {
  for (let i = 0; i < order.steps.length; i += 1) {
    if (!spoken.has(i)) return i;
  }
  return null;
}

/**
 * The next `count` upcoming (not-yet-spoken) step indices, in ascending order.
 * Returns fewer than `count` if there aren't enough unspoken steps remaining.
 * Returns an empty array if all steps are spoken or `count` is non-positive.
 */
export function upcomingStepIndices(
  order: BuildOrder,
  spoken: ReadonlySet<number>,
  count: number,
): number[] {
  if (count <= 0) return [];
  const upcoming: number[] = [];
  for (let i = 0; i < order.steps.length && upcoming.length < count; i += 1) {
    if (!spoken.has(i)) {
      upcoming.push(i);
    }
  }
  return upcoming;
}
