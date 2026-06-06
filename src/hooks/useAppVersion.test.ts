// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppVersion } from "./useAppVersion";

const getVersionMock = vi.fn<() => Promise<string>>();

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: () => getVersionMock(),
}));

describe("useAppVersion", () => {
  beforeEach(() => {
    getVersionMock.mockReset();
  });

  it("starts null before the read resolves", () => {
    let resolve: (v: string) => void = () => {};
    getVersionMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => useAppVersion());

    expect(result.current).toBeNull();
    resolve("0.1.0");
  });

  it("resolves to the app version on success", async () => {
    getVersionMock.mockResolvedValue("0.1.0");

    const { result } = renderHook(() => useAppVersion());

    await waitFor(() => expect(result.current).toBe("0.1.0"));
  });

  it("stays null when the read rejects", async () => {
    getVersionMock.mockRejectedValue(new Error("no version"));

    const { result } = renderHook(() => useAppVersion());

    // Give the rejected promise a tick to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBeNull();
  });

  it("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (v: string) => void = () => {};
    getVersionMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result, unmount } = renderHook(() => useAppVersion());
    unmount();

    resolve("0.1.0");
    await Promise.resolve();

    expect(result.current).toBeNull();
  });
});
