// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireTauriEvent,
  lastUnlistenSpy,
  listenMock,
  resetTauriMocks,
} from "../test/tauriMocks";
import { DISCONNECTED_SNAPSHOT, GAME_EVENT, type GameSnapshot } from "../types/sc2";
import { useGameSnapshot } from "./useGameSnapshot";

vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));

const LIVE_SNAPSHOT: GameSnapshot = {
  connected: true,
  in_game: true,
  is_replay: false,
  display_time: 42,
  players: [{ id: 1, name: "P1", type: "user", race: "Terr", result: "Undecided" }],
};

describe("useGameSnapshot", () => {
  beforeEach(() => {
    resetTauriMocks();
  });

  it("starts at the disconnected snapshot and subscribes to the game event", () => {
    const { result } = renderHook(() => useGameSnapshot());

    expect(result.current.snapshot).toEqual(DISCONNECTED_SNAPSHOT);
    expect(listenMock).toHaveBeenCalledWith(GAME_EVENT, expect.any(Function));
  });

  it("updates the snapshot when a GAME_EVENT payload is fired", () => {
    const { result } = renderHook(() => useGameSnapshot());

    act(() => {
      fireTauriEvent<GameSnapshot>(GAME_EVENT, LIVE_SNAPSHOT);
    });

    expect(result.current.snapshot).toEqual(LIVE_SNAPSHOT);
  });

  it("refetch returns the current snapshot", () => {
    const { result } = renderHook(() => useGameSnapshot());

    act(() => {
      fireTauriEvent<GameSnapshot>(GAME_EVENT, LIVE_SNAPSHOT);
    });

    expect(result.current.refetch()).toEqual(LIVE_SNAPSHOT);
  });

  it("unsubscribes the listener on unmount", async () => {
    const { unmount } = renderHook(() => useGameSnapshot());

    // Let the unlistenPromise resolve so the spy is registered.
    await act(async () => {
      await Promise.resolve();
    });

    const unlisten = lastUnlistenSpy();
    expect(unlisten).toBeDefined();

    unmount();
    await act(async () => {
      await Promise.resolve();
    });

    expect(unlisten).toHaveBeenCalledTimes(1);
  });
});
