// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeMock, resetTauriMocks } from "../test/tauriMocks";
import { useAppIcon } from "./useAppIcon";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const DATA_URL = "data:image/png;base64,AAAA";

describe("useAppIcon", () => {
  beforeEach(() => {
    resetTauriMocks();
  });

  it("starts null before the invoke resolves", () => {
    let resolve: (v: string) => void = () => {};
    invokeMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => useAppIcon());

    expect(result.current).toBeNull();
    resolve(DATA_URL);
  });

  it("resolves to the icon data URL on success", async () => {
    invokeMock.mockResolvedValue(DATA_URL);

    const { result } = renderHook(() => useAppIcon());

    await waitFor(() => expect(result.current).toBe(DATA_URL));
    expect(invokeMock).toHaveBeenCalledWith("app_icon");
  });

  it("stays null when the invoke rejects", async () => {
    invokeMock.mockRejectedValue(new Error("no icon"));

    const { result } = renderHook(() => useAppIcon());

    // Give the rejected promise a tick to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBeNull();
  });

  it("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (v: string) => void = () => {};
    invokeMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result, unmount } = renderHook(() => useAppIcon());
    unmount();

    resolve(DATA_URL);
    await Promise.resolve();

    expect(result.current).toBeNull();
  });
});
