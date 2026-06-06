# Interpolated game clock for sub-second cue precision

## Goal

The SC2 Client API is polled ~1s, so `snapshot.display_time` advances in ~1s
steps. For a timing coach this means voice cues can fire up to ~1s late and the
countdown ticks coarsely. Add a smoothly-advancing **interpolated clock** that
estimates the current in-game time between polls using the local wall clock, and
drive both the cue scheduler and the countdown from it.

## Background (existing code)
- `src/hooks/useGameSnapshot.ts` returns the latest `GameSnapshot`
  (`{ connected, in_game, is_replay, display_time, players }`) on the `sc2://game`
  event (~1s cadence).
- `src/hooks/useBuildOrderVoice.ts` currently schedules cues off
  `snapshot.display_time` directly; `src/App.tsx` computes the countdown off it too.

## Design (decided — autonomous)

| Topic | Decision |
|-------|----------|
| Anchor | On each in-game snapshot, record `(anchorDisplayTime = display_time, anchorAtMs = performance.now())`. |
| Interpolation | `current = anchorDisplayTime + (now - anchorAtMs)/1000`, re-anchored every snapshot so error never accumulates beyond one poll interval. |
| Tick | A ~100ms interval drives re-renders of the interpolated value (rAF is overkill for 1 Hz source); cleared on unmount. |
| Pause/stall detection | If a new snapshot's `display_time` equals the previous sample's (no progress across polls), treat the game as paused/loading and **freeze** the interpolated value at the anchor (do not advance) until `display_time` changes again. |
| Not in game | When `!in_game` (or disconnected/replay), the interpolated clock returns the raw `display_time` (0/idle) and does not advance. |
| Monotonic safety | Interpolated time only advances between anchors; re-anchoring snaps to true time. Cue spoken-set already prevents re-fire, so a small backward re-anchor cannot double-fire. |
| Pure core | Extract `interpolate({ anchorDisplayTime, anchorAtMs, nowMs, paused }) -> number` as a pure, unit-tested function separate from the React hook. |

## Requirements
* R1: `useInterpolatedClock(snapshot)` hook returns a number that advances
  smoothly (~100ms granularity) while in a live game, re-anchored on every
  snapshot, frozen when paused/stalled, and equal to the raw value when not in game.
* R2: `useBuildOrderVoice` triggers cues off the interpolated clock, not the raw
  poll value, so cues fire within ~100ms of `time - leadTimeSec`.
* R3: The overlay countdown in `App.tsx` uses the interpolated clock for a smooth
  per-second display.
* R4: Pause/stall freezes the clock so cues do not fire while the game is paused.

## Acceptance Criteria
* [ ] Pure `interpolate` function unit-tested: advances with elapsed wall time;
      frozen when `paused`; returns anchor when `nowMs == anchorAtMs`.
* [ ] Cue scheduling and countdown consume the interpolated clock.
* [ ] Stalled `display_time` across polls freezes the interpolated value (test).
* [ ] No double-speak introduced; existing voice tests still pass.

## Definition of Done
* `npx tsc --noEmit`, `pnpm build`, `pnpm test` green. (No Rust changes expected.)
* Follows `.trellis/spec/frontend/*` (hooks, immutable state, type-safety, quality).

## Out of Scope
* Changing the Rust poll cadence or the 6119 contract.
* Handling game-speed settings other than "Faster" (displayTime is already the
  on-screen clock, so real-time interpolation matches it 1:1).

## Technical Notes
* Place the pure function in `src/lib/clock.ts` (+ `clock.test.ts`); the hook in
  `src/hooks/useInterpolatedClock.ts`.
* The hook needs the previous sample's `display_time` to detect a stall — keep it
  in a ref; re-anchor `anchorAtMs` only when `display_time` changes (so a frozen
  clock stays frozen rather than re-anchoring to a moving `now`).
