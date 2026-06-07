// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  availableMonitorsMock,
  fireTauriEvent,
  getCurrentWindowMock,
  invokeMock,
  listenMock,
  onCloseRequestedMock,
  outerPositionMock,
  resetTauriMocks,
  setIgnoreCursorEventsMock,
} from "../test/tauriMocks";
import { type Settings } from "./useSettings";
import { useWindowControls } from "./useWindowControls";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: listenMock,
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: getCurrentWindowMock,
  availableMonitors: availableMonitorsMock,
}));

const TOGGLE_EVENT = "ui://toggle-clickthrough";

const SETTINGS: Settings = {
  clientApiPort: 6119,
  leadTimeSecOverride: null,
  voiceEnabled: true,
  voiceRate: 1.0,
  clickThrough: true,
  windowX: null,
  windowY: null,
  activeBuildOverride: null,
  theme: "system",
  clickThroughShortcut: "CmdOrCtrl+Shift+S",
};

/** A close-requested event carrying a preventDefault spy. */
interface CloseEvent {
  preventDefault: () => void;
}

describe("useWindowControls", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetTauriMocks();
    onCloseRequestedMock.mockResolvedValue(vi.fn());
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("applies click-through state on mount", () => {
    const saveSettings = vi.fn(() => Promise.resolve());
    renderHook(() => useWindowControls({ settings: SETTINGS, saveSettings }));

    expect(setIgnoreCursorEventsMock).toHaveBeenCalledWith(true);
  });

  it("re-applies click-through when the setting changes", () => {
    const saveSettings = vi.fn(() => Promise.resolve());
    const { rerender } = renderHook(
      ({ settings }) => useWindowControls({ settings, saveSettings }),
      { initialProps: { settings: SETTINGS } },
    );

    rerender({ settings: { ...SETTINGS, clickThrough: false } });
    expect(setIgnoreCursorEventsMock).toHaveBeenLastCalledWith(false);
  });

  it("disables click-through when the toggle event fires", async () => {
    const saveSettings = vi.fn(() => Promise.resolve());
    renderHook(() => useWindowControls({ settings: SETTINGS, saveSettings }));

    // Let the async listen() registration resolve.
    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      fireTauriEvent<void>(TOGGLE_EVENT, undefined);
      await Promise.resolve();
    });

    expect(saveSettings).toHaveBeenCalledWith({ ...SETTINGS, clickThrough: false });
  });

  it("persists logical position and does NOT exit the app on close-requested", async () => {
    const saveSettings = vi.fn(() => Promise.resolve());
    let closeHandler: ((e: CloseEvent) => Promise<void>) | null = null;
    onCloseRequestedMock.mockImplementation(
      (handler: (e: CloseEvent) => Promise<void>) => {
        closeHandler = handler;
        return Promise.resolve(vi.fn());
      },
    );
    outerPositionMock.mockResolvedValue({ x: 200, y: 300 });
    availableMonitorsMock.mockResolvedValue([
      {
        position: { x: 0, y: 0 },
        size: { width: 2000, height: 2000 },
        scaleFactor: 2,
      },
    ]);
    invokeMock.mockResolvedValue(undefined);

    renderHook(() => useWindowControls({ settings: SETTINGS, saveSettings }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(closeHandler).not.toBeNull();
    const preventDefault = vi.fn();
    await act(async () => {
      await closeHandler!({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    // x=200 / scaleFactor 2 = 100, y=300 / 2 = 150
    expect(saveSettings).toHaveBeenCalledWith({
      ...SETTINGS,
      windowX: 100,
      windowY: 150,
    });
    // The overlay close must NOT quit the app — Rust hides the window instead.
    expect(invokeMock).not.toHaveBeenCalledWith("exit_app");
  });

  it("does NOT exit the app when no monitor matches the position", async () => {
    const saveSettings = vi.fn(() => Promise.resolve());
    let closeHandler: ((e: CloseEvent) => Promise<void>) | null = null;
    onCloseRequestedMock.mockImplementation(
      (handler: (e: CloseEvent) => Promise<void>) => {
        closeHandler = handler;
        return Promise.resolve(vi.fn());
      },
    );
    outerPositionMock.mockResolvedValue({ x: 9999, y: 9999 });
    availableMonitorsMock.mockResolvedValue([]);
    invokeMock.mockResolvedValue(undefined);

    renderHook(() => useWindowControls({ settings: SETTINGS, saveSettings }));
    await act(async () => {
      await Promise.resolve();
    });

    const preventDefault = vi.fn();
    await act(async () => {
      await closeHandler!({ preventDefault });
    });

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(saveSettings).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalledWith("exit_app");
  });
});
