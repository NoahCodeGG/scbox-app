// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeMock, resetTauriMocks } from "../test/tauriMocks";
import { normalizeSettings } from "../lib/settings";
import { type Settings, useSettings } from "./useSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock,
}));

const { emitMock } = vi.hoisted(() => ({
  emitMock: vi.fn(() => Promise.resolve()),
}));
vi.mock("@tauri-apps/api/event", () => ({
  emit: emitMock,
}));

const DEFAULT_SETTINGS: Settings = {
  clientApiPort: 6119,
  leadTimeSecOverride: null,
  voiceEnabled: true,
  voiceRate: 1.0,
  clickThrough: false,
  windowX: null,
  windowY: null,
  activeBuildOverride: null,
};

describe("useSettings", () => {
  beforeEach(() => {
    resetTauriMocks();
    emitMock.mockClear();
  });

  it("loads settings on mount and normalizes them", async () => {
    // Out-of-range port + rate should be normalized by the hook.
    const loaded: Settings = {
      ...DEFAULT_SETTINGS,
      clientApiPort: 999999,
      voiceRate: 5,
    };
    invokeMock.mockResolvedValueOnce(loaded);

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.settings.clientApiPort).toBe(6119); // out-of-range -> default
    });
    expect(result.current.settings.voiceRate).toBe(2.0); // clamped to max
    expect(result.current.error).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("load_settings");
  });

  it("sets error when the load command rejects", async () => {
    invokeMock.mockRejectedValueOnce(new Error("load boom"));

    const { result } = renderHook(() => useSettings());

    await waitFor(() => {
      expect(result.current.error).toBe("load boom");
    });
    // Falls back to defaults rather than a broken state.
    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it("saves normalized settings and updates local state on success", async () => {
    invokeMock.mockResolvedValueOnce(DEFAULT_SETTINGS); // load
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_settings"));

    invokeMock.mockResolvedValueOnce(undefined); // save

    const next: Settings = { ...DEFAULT_SETTINGS, voiceRate: 3, voiceEnabled: false };
    await act(async () => {
      await result.current.saveSettings(next);
    });

    const expected = normalizeSettings(next);
    expect(invokeMock).toHaveBeenCalledWith("save_settings", { settings: expected });
    expect(result.current.settings).toEqual(expected);
    expect(result.current.settings.voiceRate).toBe(2.0); // clamped
    expect(result.current.error).toBeNull();
    // A successful save notifies other windows to reload settings live.
    expect(emitMock).toHaveBeenCalledWith("settings://changed");
  });

  it("sets error when the save command rejects", async () => {
    invokeMock.mockResolvedValueOnce(DEFAULT_SETTINGS); // load
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_settings"));

    invokeMock.mockRejectedValueOnce(new Error("save boom"));

    await act(async () => {
      await result.current.saveSettings(DEFAULT_SETTINGS);
    });

    expect(result.current.error).toBe("save boom");
  });

  it("reloads settings from disk on demand", async () => {
    invokeMock.mockResolvedValueOnce(DEFAULT_SETTINGS); // initial load
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_settings"));

    const updated: Settings = {
      ...DEFAULT_SETTINGS,
      activeBuildOverride: "tvp.json",
      clickThrough: true,
    };
    invokeMock.mockResolvedValueOnce(updated); // reload

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.settings).toEqual(normalizeSettings(updated));
    expect(result.current.error).toBeNull();
  });

  it("sets error when reload rejects", async () => {
    invokeMock.mockResolvedValueOnce(DEFAULT_SETTINGS); // initial load
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("load_settings"));

    invokeMock.mockRejectedValueOnce(new Error("reload boom"));

    await act(async () => {
      await result.current.reload();
    });

    expect(result.current.error).toBe("reload boom");
  });
});
