// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildOrder } from "../types/build";
import type { GameSnapshot } from "../types/sc2";
import { type RecurringOptions, useRecurringCues } from "./useRecurringCues";

const speakMock = vi.fn();
const cancelAllMock = vi.fn();

vi.mock("../lib/speech", () => ({
  speak: (text: string, rate: number) => speakMock(text, rate),
  cancelAll: () => cancelAllMock(),
}));

// One recurring cue: inject every 30s starting at 100, lead 4 → first announce
// at 96, then 126, 156, ...
const ORDER: BuildOrder = {
  matchup: "ZvX",
  race: "Zerg",
  name: "test",
  leadTimeSec: 4,
  steps: [],
  recurring: [{ say: "注卵", startSec: 100, intervalSec: 30 }],
};

function liveSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    connected: true,
    status: "ok",
    in_game: true,
    is_replay: false,
    display_time: 0,
    players: [{ id: 1, name: "P1", type: "user", race: "Zerg", result: "Undecided" }],
    ...overrides,
  };
}

const VOICE_ON: RecurringOptions = {
  voiceEnabled: true,
  voiceRate: 1.2,
  leadTimeSecOverride: null,
};

describe("useRecurringCues", () => {
  beforeEach(() => {
    speakMock.mockReset();
    cancelAllMock.mockReset();
  });

  it("does not announce before the first trigger and fires occurrence 0 at startSec - lead", () => {
    const { rerender, result } = renderHook(
      ({ time }) => useRecurringCues(liveSnapshot(), ORDER, time, VOICE_ON),
      { initialProps: { time: 0 } }, // before first trigger
    );

    expect(speakMock).not.toHaveBeenCalled();
    // Next target is occurrence 0's target time (100), not the announce time.
    expect(result.current[0].nextTargetTime).toBe(100);

    rerender({ time: 96 }); // startSec(100) - lead(4)

    expect(speakMock).toHaveBeenCalledTimes(1);
    expect(speakMock).toHaveBeenCalledWith("注卵", 1.2);
    // Next target moves to occurrence 1 (130).
    expect(result.current[0].nextTargetTime).toBe(130);
  });

  it("advances by interval, firing each occurrence exactly once", () => {
    const { rerender } = renderHook(
      ({ time }) => useRecurringCues(liveSnapshot(), ORDER, time, VOICE_ON),
      { initialProps: { time: 0 } },
    );

    rerender({ time: 96 }); // occurrence 0
    rerender({ time: 110 }); // nothing new yet
    rerender({ time: 126 }); // occurrence 1 (130 - 4)
    rerender({ time: 156 }); // occurrence 2 (160 - 4)

    expect(speakMock).toHaveBeenCalledTimes(3);
  });

  it("does not speak when recurring voice is disabled but still reports countdown", () => {
    const voiceOff: RecurringOptions = { ...VOICE_ON, voiceEnabled: false };
    const { rerender, result } = renderHook(
      ({ time }) => useRecurringCues(liveSnapshot(), ORDER, time, voiceOff),
      { initialProps: { time: 0 } },
    );

    rerender({ time: 96 });

    expect(speakMock).not.toHaveBeenCalled();
    // Countdown still advances to the next occurrence.
    expect(result.current[0].nextTargetTime).toBe(130);
  });

  it("stops announcing and returns null countdown after endSec", () => {
    const endOrder: BuildOrder = {
      ...ORDER,
      recurring: [{ say: "注卵", startSec: 100, intervalSec: 30, endSec: 130 }],
    };
    const { rerender, result } = renderHook(
      ({ time }) => useRecurringCues(liveSnapshot(), endOrder, time, VOICE_ON),
      { initialProps: { time: 0 } },
    );

    rerender({ time: 96 }); // occurrence 0 (target 100)
    rerender({ time: 126 }); // occurrence 1 (target 130, == endSec)
    expect(speakMock).toHaveBeenCalledTimes(2);
    expect(result.current[0].nextTargetTime).toBeNull(); // no occurrence past 130

    rerender({ time: 200 }); // well past endSec
    expect(speakMock).toHaveBeenCalledTimes(2); // no further announcements
    expect(result.current[0].nextTargetTime).toBeNull();
  });

  it("suppresses the backlog on a late connect (no replay of past occurrences)", () => {
    // First live frame already at clock 200: occurrences 0..3 (targets 100/130/
    // 160/190, announce 96/126/156/186) are all past — none should be replayed.
    const { result } = renderHook(() =>
      useRecurringCues(liveSnapshot({ display_time: 200 }), ORDER, 200, VOICE_ON),
    );

    expect(speakMock).not.toHaveBeenCalled();
    // Countdown points at the next future occurrence (220).
    expect(result.current[0].nextTargetTime).toBe(220);
  });

  it("does not announce and returns null countdown for a replay", () => {
    const { result } = renderHook(() =>
      useRecurringCues(liveSnapshot({ is_replay: true }), ORDER, 200, VOICE_ON),
    );

    expect(speakMock).not.toHaveBeenCalled();
    expect(result.current[0].nextTargetTime).toBeNull();
  });

  it("does not announce and returns null countdown when not in game", () => {
    const { result } = renderHook(() =>
      useRecurringCues(liveSnapshot({ in_game: false }), ORDER, 200, VOICE_ON),
    );

    expect(speakMock).not.toHaveBeenCalled();
    expect(result.current[0].nextTargetTime).toBeNull();
  });

  it("cancels and resets when the game ends", () => {
    const { rerender } = renderHook(
      ({ snapshot, time }) => useRecurringCues(snapshot, ORDER, time, VOICE_ON),
      { initialProps: { snapshot: liveSnapshot(), time: 96 } },
    );

    cancelAllMock.mockClear();
    rerender({
      snapshot: liveSnapshot({
        in_game: false,
        players: [
          { id: 1, name: "P1", type: "user", race: "Zerg", result: "Victory" },
        ],
      }),
      time: 96,
    });

    expect(cancelAllMock).toHaveBeenCalled();
  });

  it("resets and re-times from zero on a fast rematch (clock jumps back while live)", () => {
    const { rerender } = renderHook(
      ({ snapshot, time }) => useRecurringCues(snapshot, ORDER, time, VOICE_ON),
      { initialProps: { snapshot: liveSnapshot({ display_time: 156 }), time: 156 } },
    );

    // First frame at 156 seeds the backlog as announced (no speak). Advance once.
    rerender({ snapshot: liveSnapshot({ display_time: 186 }), time: 186 }); // occ 3 (190-4)
    expect(speakMock).toHaveBeenCalledTimes(1);

    cancelAllMock.mockClear();
    speakMock.mockClear();

    // New match without leaving live: clock snaps back to ~0.
    rerender({ snapshot: liveSnapshot({ display_time: 0 }), time: 0 });
    expect(cancelAllMock).toHaveBeenCalled();

    // Re-timing from 0: occurrence 0 fires again at 96.
    rerender({ snapshot: liveSnapshot({ display_time: 96 }), time: 96 });
    expect(speakMock).toHaveBeenCalledTimes(1);
  });

  it("returns an empty array and has no side effects when there are no recurring cues", () => {
    const plain: BuildOrder = { ...ORDER, recurring: undefined };
    const { rerender, result } = renderHook(
      ({ time }) => useRecurringCues(liveSnapshot(), plain, time, VOICE_ON),
      { initialProps: { time: 0 } },
    );

    rerender({ time: 200 });

    expect(result.current).toEqual([]);
    expect(speakMock).not.toHaveBeenCalled();
  });
});
