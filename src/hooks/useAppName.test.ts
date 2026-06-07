// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppName } from "./useAppName";

const getNameMock = vi.fn<() => Promise<string>>();

vi.mock("@tauri-apps/api/app", () => ({
  getName: () => getNameMock(),
}));

describe("useAppName", () => {
  beforeEach(() => {
    getNameMock.mockReset();
  });

  it("starts null before the read resolves", () => {
    let resolve: (v: string) => void = () => {};
    getNameMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => useAppName());

    expect(result.current).toBeNull();
    resolve("SCBox Assistant");
  });

  it("resolves to the app name on success", async () => {
    getNameMock.mockResolvedValue("SCBox Assistant");

    const { result } = renderHook(() => useAppName());

    await waitFor(() => expect(result.current).toBe("SCBox Assistant"));
  });

  it("stays null when the read rejects", async () => {
    getNameMock.mockRejectedValue(new Error("no name"));

    const { result } = renderHook(() => useAppName());

    // Give the rejected promise a tick to settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current).toBeNull();
  });

  it("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (v: string) => void = () => {};
    getNameMock.mockReturnValue(
      new Promise<string>((r) => {
        resolve = r;
      }),
    );

    const { result, unmount } = renderHook(() => useAppName());
    unmount();

    resolve("SCBox Assistant");
    await Promise.resolve();

    expect(result.current).toBeNull();
  });
});
