// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSnapshot } from "../types/sc2";
import { useInterpolatedClock } from "./useInterpolatedClock";

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    connected: true,
    status: "ok",
    in_game: true,
    is_replay: false,
    display_time: 0,
    players: [],
    ...overrides,
  };
}

const TICK_MS = 100;

describe("useInterpolatedClock", () => {
  let now = 0;

  beforeEach(() => {
    vi.useFakeTimers();
    now = 1_000;
    vi.spyOn(performance, "now").mockImplementation(() => now);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /** Advance both the wall clock spy and the fake-timer scheduler together. */
  function advance(ms: number): void {
    act(() => {
      now += ms;
      vi.advanceTimersByTime(ms);
    });
  }

  it("returns the raw display_time for a live snapshot", () => {
    const { result } = renderHook(
      ({ s }) => useInterpolatedClock(s),
      { initialProps: { s: snapshot({ display_time: 30 }) } },
    );

    expect(result.current).toBe(30);
  });

  it("interpolates forward between polls on a live game", () => {
    const { result } = renderHook(
      ({ s }) => useInterpolatedClock(s),
      { initialProps: { s: snapshot({ display_time: 30 }) } },
    );

    advance(TICK_MS * 5); // 500ms => +0.5s

    expect(result.current).toBeCloseTo(30.5, 5);
  });

  it("re-anchors when display_time advances across polls", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useInterpolatedClock(s),
      { initialProps: { s: snapshot({ display_time: 30 }) } },
    );

    advance(TICK_MS * 5); // drifts to ~30.5
    rerender({ s: snapshot({ display_time: 31 }) }); // re-anchor to true 31

    expect(result.current).toBe(31);
  });

  it("freezes when display_time stalls across polls", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useInterpolatedClock(s),
      { initialProps: { s: snapshot({ display_time: 30 }) } },
    );

    // Second identical poll => paused: should freeze at the anchor value.
    rerender({ s: snapshot({ display_time: 30 }) });
    advance(TICK_MS * 5);

    expect(result.current).toBe(30);
  });

  it("resets to the raw value when the game is not live (replay)", () => {
    const { result, rerender } = renderHook(
      ({ s }) => useInterpolatedClock(s),
      { initialProps: { s: snapshot({ display_time: 30 }) } },
    );

    advance(TICK_MS * 5);
    rerender({ s: snapshot({ is_replay: true, display_time: 99 }) });

    expect(result.current).toBe(99);

    // A non-live game must not advance.
    advance(TICK_MS * 5);
    expect(result.current).toBe(99);
  });

  it("clears the tick interval on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() =>
      useInterpolatedClock(snapshot({ display_time: 30 })),
    );

    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
