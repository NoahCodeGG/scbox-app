// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BuildOrder } from "../types/build";
import type { GameSnapshot } from "../types/sc2";
import { type VoiceOptions, useBuildOrderVoice } from "./useBuildOrderVoice";

const speakMock = vi.fn();
const cancelAllMock = vi.fn();

vi.mock("../lib/speech", () => ({
  speak: (text: string, rate: number) => speakMock(text, rate),
  cancelAll: () => cancelAllMock(),
}));

const ORDER: BuildOrder = {
  matchup: "TvX",
  race: "Terran",
  name: "test",
  leadTimeSec: 4,
  steps: [
    { time: 17, say: "补给站" }, // trigger 13
    { time: 30, say: "兵营" }, // trigger 26
    { time: 40, say: "精炼厂" }, // trigger 36
  ],
};

function liveSnapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    connected: true,
    status: "ok",
    in_game: true,
    is_replay: false,
    display_time: 0,
    players: [{ id: 1, name: "P1", type: "user", race: "Terr", result: "Undecided" }],
    ...overrides,
  };
}

const VOICE_ON: VoiceOptions = {
  voiceEnabled: true,
  voiceRate: 1.2,
  leadTimeSecOverride: null,
};

describe("useBuildOrderVoice", () => {
  beforeEach(() => {
    speakMock.mockReset();
    cancelAllMock.mockReset();
  });

  it("seeds the spoken set for a late-connect game, suppressing past steps", () => {
    // First live snapshot at clock 30: steps 0 (t13) and 1 (t26) already passed.
    const { result } = renderHook(() =>
      useBuildOrderVoice(liveSnapshot(), ORDER, 30, VOICE_ON),
    );

    expect(result.current.spokenCount).toBe(2);
    expect(speakMock).not.toHaveBeenCalled();
    expect(result.current.nextStep?.say).toBe("精炼厂");
  });

  it("speaks a step when it becomes due with voice enabled", () => {
    const { rerender, result } = renderHook(
      ({ time }) => useBuildOrderVoice(liveSnapshot(), ORDER, time, VOICE_ON),
      { initialProps: { time: 0 } }, // seeds empty spoken set
    );

    expect(result.current.spokenCount).toBe(0);

    rerender({ time: 13 }); // step 0 due

    expect(speakMock).toHaveBeenCalledWith("补给站", 1.2);
    expect(result.current.spokenCount).toBe(1);
  });

  it("advances the spoken set without speaking when voice is disabled", () => {
    const voiceOff: VoiceOptions = { ...VOICE_ON, voiceEnabled: false };
    const { rerender, result } = renderHook(
      ({ time }) => useBuildOrderVoice(liveSnapshot(), ORDER, time, voiceOff),
      { initialProps: { time: 0 } },
    );

    rerender({ time: 13 });

    expect(speakMock).not.toHaveBeenCalled();
    expect(result.current.spokenCount).toBe(1);
  });

  it("cancels and resets when the game ends with a decided result", () => {
    const { rerender, result } = renderHook(
      ({ snapshot, time }) => useBuildOrderVoice(snapshot, ORDER, time, VOICE_ON),
      { initialProps: { snapshot: liveSnapshot(), time: 13 } },
    );

    expect(result.current.spokenCount).toBe(1);

    rerender({
      // Backend flips in_game to false once a result is decided (single source
      // of truth); players stay populated on the SC2 end screen.
      snapshot: liveSnapshot({
        in_game: false,
        players: [
          { id: 1, name: "P1", type: "user", race: "Terr", result: "Victory" },
        ],
      }),
      time: 13,
    });

    expect(cancelAllMock).toHaveBeenCalled();
    expect(result.current.spokenCount).toBe(0);
  });

  it("cancels and resets when the snapshot becomes a replay", () => {
    const { rerender } = renderHook(
      ({ snapshot, time }) => useBuildOrderVoice(snapshot, ORDER, time, VOICE_ON),
      { initialProps: { snapshot: liveSnapshot(), time: 13 } },
    );

    cancelAllMock.mockClear();
    rerender({ snapshot: liveSnapshot({ is_replay: true }), time: 13 });

    expect(cancelAllMock).toHaveBeenCalled();
  });

  it("cancels speech on unmount", () => {
    const { unmount } = renderHook(() =>
      useBuildOrderVoice(liveSnapshot(), ORDER, 0, VOICE_ON),
    );

    cancelAllMock.mockClear();
    unmount();

    expect(cancelAllMock).toHaveBeenCalled();
  });

  it("re-seeds from scratch on a fast rematch (clock jumps back while live)", () => {
    // Drive a game forward so several steps land in the spoken set.
    const { rerender, result } = renderHook(
      ({ snapshot, time }) => useBuildOrderVoice(snapshot, ORDER, time, VOICE_ON),
      {
        initialProps: { snapshot: liveSnapshot({ display_time: 0 }), time: 0 },
      },
    );

    rerender({ snapshot: liveSnapshot({ display_time: 40 }), time: 40 });
    expect(result.current.spokenCount).toBe(3); // all steps spoken by t40
    expect(result.current.nextStep).toBeNull();

    cancelAllMock.mockClear();

    // New match WITHOUT ever leaving live: in_game stays true but the in-game
    // clock (and display_time) snap back to ~0 — a fast "play again".
    rerender({ snapshot: liveSnapshot({ display_time: 0 }), time: 0 });

    // Reset + re-seed from scratch: empty spoken set (previewSpokenSet at t<=0),
    // first step is upcoming again, and pending speech was cancelled.
    expect(cancelAllMock).toHaveBeenCalled();
    expect(result.current.spokenCount).toBe(0);
    expect(result.current.nextStep?.say).toBe("补给站");
  });

  it("speaks the time-0 opening step instead of silently suppressing it", () => {
    // ORDER_WITH_OPENER has a time-0 step with the default 4s lead: triggerTime
    // is -4, which initialSpokenSet would mark as already-spoken at t=0 (0 >= -4)
    // and thus skip without audio. previewSpokenSet returns an empty set at t<=0,
    // so the opener is NOT pre-suppressed and instead gets announced normally.
    const ORDER_WITH_OPENER: BuildOrder = {
      ...ORDER,
      steps: [{ time: 0, say: "建造农民" }, ...ORDER.steps],
    };

    const { result } = renderHook(() =>
      useBuildOrderVoice(liveSnapshot({ display_time: 0 }), ORDER_WITH_OPENER, 0, VOICE_ON),
    );

    // The opener was spoken (audio fired), not silently swallowed by seeding.
    expect(speakMock).toHaveBeenCalledWith("建造农民", 1.2);
    expect(result.current.spokenCount).toBe(1);
    expect(result.current.nextStep?.say).toBe("补给站");
  });
});
