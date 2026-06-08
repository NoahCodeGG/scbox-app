// @vitest-environment jsdom
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUpdateCheck } from "./useUpdateCheck";

const checkMock = vi.fn();
const relaunchMock = vi.fn<() => Promise<void>>();
const invokeMock = vi.fn();

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: () => checkMock(),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: () => relaunchMock(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string) => invokeMock(cmd),
}));

/** A minimal fake of the plugin's `Update` object used in tests. */
function fakeUpdate(version: string) {
  return {
    version,
    downloadAndInstall: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  };
}

describe("useUpdateCheck", () => {
  beforeEach(() => {
    checkMock.mockReset();
    relaunchMock.mockReset();
    relaunchMock.mockResolvedValue(undefined);
    invokeMock.mockReset();
  });

  it("flags available + version when the mount check finds an update", async () => {
    checkMock.mockResolvedValue(fakeUpdate("0.2.0"));

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.version).toBe("0.2.0");
    expect(result.current.upToDate).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("stays unavailable + upToDate when no update is returned", async () => {
    checkMock.mockResolvedValue(null);

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => expect(result.current.upToDate).toBe(true));
    expect(result.current.available).toBe(false);
    expect(result.current.version).toBeNull();
  });

  it("captures the error and does not throw when the check rejects", async () => {
    checkMock.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useUpdateCheck());

    await waitFor(() => expect(result.current.error).toBe("offline"));
    expect(result.current.available).toBe(false);
  });

  it("re-checks via check() and surfaces a fresh result", async () => {
    checkMock.mockResolvedValueOnce(fakeUpdate("0.5.0")); // mount: available
    const { result } = renderHook(() => useUpdateCheck());
    await waitFor(() => expect(result.current.available).toBe(true));

    checkMock.mockResolvedValueOnce(fakeUpdate("0.3.0"));
    await act(async () => {
      await result.current.check();
    });

    expect(result.current.available).toBe(true);
    expect(result.current.version).toBe("0.3.0");
  });

  it("check() reports up-to-date when no update is returned", async () => {
    checkMock.mockResolvedValueOnce(fakeUpdate("0.5.0")); // mount: available
    const { result } = renderHook(() => useUpdateCheck());
    await waitFor(() => expect(result.current.available).toBe(true));

    checkMock.mockResolvedValueOnce(null); // manual re-check: now current
    await act(async () => {
      await result.current.check();
    });

    expect(result.current.available).toBe(false);
    expect(result.current.version).toBeNull();
    expect(result.current.upToDate).toBe(true);
  });

  it("install() is a no-op (sets upToDate) when no update is available", async () => {
    checkMock.mockResolvedValueOnce(null); // mount
    const { result } = renderHook(() => useUpdateCheck());
    await waitFor(() => expect(result.current.upToDate).toBe(true));

    checkMock.mockResolvedValueOnce(null); // install's own check: nothing
    await act(async () => {
      await result.current.install();
    });

    expect(relaunchMock).not.toHaveBeenCalled();
    expect(result.current.available).toBe(false);
    expect(result.current.upToDate).toBe(true);
  });

  it("install() downloads, installs, then relaunches", async () => {
    const update = fakeUpdate("0.4.0");
    checkMock.mockResolvedValueOnce(null); // mount
    const { result } = renderHook(() => useUpdateCheck());
    await waitFor(() => expect(result.current.upToDate).toBe(true));

    checkMock.mockResolvedValueOnce(update); // install's own check
    await act(async () => {
      await result.current.install();
    });

    expect(update.downloadAndInstall).toHaveBeenCalledOnce();
    expect(relaunchMock).toHaveBeenCalledOnce();
    expect(result.current.error).toBeNull();
  });

  it("install() captures errors without relaunching", async () => {
    checkMock.mockResolvedValueOnce(null); // mount
    const { result } = renderHook(() => useUpdateCheck());
    await waitFor(() => expect(result.current.upToDate).toBe(true));

    checkMock.mockRejectedValueOnce(new Error("verify failed"));
    await act(async () => {
      await result.current.install();
    });

    expect(result.current.error).toBe("verify failed");
    expect(relaunchMock).not.toHaveBeenCalled();
  });

  it("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (v: unknown) => void = () => {};
    checkMock.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );

    const { result, unmount } = renderHook(() => useUpdateCheck());
    unmount();

    resolve(fakeUpdate("9.9.9"));
    await Promise.resolve();
    await Promise.resolve();

    expect(result.current.available).toBe(false);
  });

  describe("pre-release channel", () => {
    it("stable check() is used when prereleaseUpdates is false", async () => {
      checkMock.mockResolvedValueOnce(null); // mount
      const { result } = renderHook(() => useUpdateCheck(false));
      await waitFor(() => expect(result.current.upToDate).toBe(true));

      checkMock.mockResolvedValueOnce(fakeUpdate("0.3.0"));
      await act(async () => {
        await result.current.check();
      });

      expect(invokeMock).not.toHaveBeenCalled();
      expect(result.current.available).toBe(true);
      expect(result.current.version).toBe("0.3.0");
    });

    it("checking invokes the Rust command and relaunches on install", async () => {
      checkMock.mockResolvedValueOnce(null); // mount uses stable check()
      invokeMock.mockResolvedValueOnce("0.2.0-beta.1"); // installed version
      const { result } = renderHook(() => useUpdateCheck(true));
      await waitFor(() => expect(result.current.upToDate).toBe(true));

      await act(async () => {
        await result.current.check();
      });

      expect(invokeMock).toHaveBeenCalledWith("check_prerelease_update");
      expect(result.current.available).toBe(true);
      expect(result.current.version).toBe("0.2.0-beta.1");
      expect(relaunchMock).toHaveBeenCalledOnce();
    });

    it("checking reports up-to-date when the command returns null", async () => {
      checkMock.mockResolvedValueOnce(null); // mount
      invokeMock.mockResolvedValueOnce(null); // no pre-release update
      const { result } = renderHook(() => useUpdateCheck(true));
      await waitFor(() => expect(result.current.upToDate).toBe(true));

      await act(async () => {
        await result.current.check();
      });

      expect(result.current.available).toBe(false);
      expect(result.current.version).toBeNull();
      expect(result.current.upToDate).toBe(true);
      expect(relaunchMock).not.toHaveBeenCalled();
    });

    it("surfaces a visible error when the pre-release command rejects", async () => {
      checkMock.mockResolvedValueOnce(null); // mount
      invokeMock.mockRejectedValueOnce(new Error("no release"));
      const { result } = renderHook(() => useUpdateCheck(true));
      await waitFor(() => expect(result.current.upToDate).toBe(true));

      await act(async () => {
        await result.current.check();
      });

      expect(result.current.error).toBe("no release");
      expect(relaunchMock).not.toHaveBeenCalled();
    });
  });
});
