// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeMock, resetTauriMocks } from "../test/tauriMocks";
import { FALLBACK_BUILD } from "../lib/builds";
import type { LoadResult, StoredBuild } from "../types/build";
import { useBuildOrders } from "./useBuildOrders";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const STORED: StoredBuild[] = [
  {
    filename: "tvp.json",
    build: { matchup: "TvP", race: "Terran", leadTimeSec: 4, steps: [] },
  },
];

describe("useBuildOrders", () => {
  beforeEach(() => {
    resetTauriMocks();
  });

  it("loads builds on mount and exposes builds/stored/errors", async () => {
    const result: LoadResult = { builds: STORED, errors: ["bad.json: oops"] };
    invokeMock.mockResolvedValueOnce(result);

    const { result: hook } = renderHook(() => useBuildOrders());

    await waitFor(() => expect(hook.current.stored).toEqual(STORED));
    expect(hook.current.builds).toEqual([STORED[0].build]);
    expect(hook.current.errors).toEqual(["bad.json: oops"]);
    expect(hook.current.loadError).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("load_build_orders");
  });

  it("falls back to the bundled build and surfaces loadError on hard failure", async () => {
    invokeMock.mockRejectedValueOnce(new Error("disk gone"));

    const { result: hook } = renderHook(() => useBuildOrders());

    await waitFor(() => expect(hook.current.loadError).toBe("disk gone"));
    expect(hook.current.builds).toEqual([FALLBACK_BUILD]);
    expect(hook.current.errors).toEqual([]);
  });

  it("reload re-runs the load command", async () => {
    invokeMock.mockResolvedValueOnce({ builds: [], errors: [] } satisfies LoadResult);
    const { result: hook } = renderHook(() => useBuildOrders());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledTimes(1));

    invokeMock.mockResolvedValueOnce({ builds: STORED, errors: [] } satisfies LoadResult);
    await act(async () => {
      hook.current.reload();
      await Promise.resolve();
    });

    await waitFor(() => expect(hook.current.stored).toEqual(STORED));
    expect(invokeMock).toHaveBeenCalledTimes(2);
  });
});
