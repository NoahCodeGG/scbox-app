// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UpdateCheckState } from "./useUpdateCheck";
import { useUpdateToast } from "./useUpdateToast";

const toastMock = vi.fn();
const toastLoadingMock = vi.fn();
const installMock = vi.fn<() => Promise<void>>();
const useUpdateCheckMock = vi.fn<(p?: boolean) => UpdateCheckState>();

vi.mock("sonner", () => {
  const toast = (...args: unknown[]) => toastMock(...args);
  toast.loading = (...args: unknown[]) => toastLoadingMock(...args);
  return { toast };
});

vi.mock("./useUpdateCheck", () => ({
  useUpdateCheck: (prereleaseUpdates?: boolean) =>
    useUpdateCheckMock(prereleaseUpdates),
}));

/** Build a full UpdateCheckState with overridable fields. */
function updateState(
  overrides: Partial<UpdateCheckState> = {},
): UpdateCheckState {
  return {
    available: false,
    version: null,
    busy: false,
    error: null,
    upToDate: false,
    check: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    install: installMock,
    ...overrides,
  };
}

describe("useUpdateToast", () => {
  beforeEach(() => {
    toastMock.mockReset();
    toastLoadingMock.mockReset();
    installMock.mockReset();
    installMock.mockResolvedValue(undefined);
    useUpdateCheckMock.mockReset();
  });

  it("does not prompt when no update is available", () => {
    useUpdateCheckMock.mockReturnValue(updateState({ available: false }));

    renderHook(() => useUpdateToast());

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("does not prompt when available but version is missing", () => {
    useUpdateCheckMock.mockReturnValue(
      updateState({ available: true, version: null }),
    );

    renderHook(() => useUpdateToast());

    expect(toastMock).not.toHaveBeenCalled();
  });

  it("raises a titled toast with an update action when available", () => {
    useUpdateCheckMock.mockReturnValue(
      updateState({ available: true, version: "1.2.3" }),
    );

    renderHook(() => useUpdateToast());

    expect(toastMock).toHaveBeenCalledTimes(1);
    const [message, options] = toastMock.mock.calls[0] as [
      string,
      { action: { label: string; onClick: () => void } },
    ];
    expect(message).toBe("发现新版本 v1.2.3");
    expect(options.action.label).toBe("立即更新");
  });

  it("invokes install() and a loading toast when the action is clicked", () => {
    useUpdateCheckMock.mockReturnValue(
      updateState({ available: true, version: "1.2.3" }),
    );

    renderHook(() => useUpdateToast());

    const [, options] = toastMock.mock.calls[0] as [
      string,
      { action: { onClick: () => void } },
    ];
    options.action.onClick();

    expect(toastLoadingMock).toHaveBeenCalledWith("正在下载更新…");
    expect(installMock).toHaveBeenCalledOnce();
  });

  it("prompts only once per session across re-renders", () => {
    useUpdateCheckMock.mockReturnValue(
      updateState({ available: true, version: "1.2.3" }),
    );

    const { rerender } = renderHook(() => useUpdateToast());
    rerender();
    rerender();

    expect(toastMock).toHaveBeenCalledTimes(1);
  });

  it("forwards the prerelease flag to the resident update check", () => {
    useUpdateCheckMock.mockReturnValue(updateState());

    renderHook(() => useUpdateToast(true));

    expect(useUpdateCheckMock).toHaveBeenCalledWith(true);
  });
});
