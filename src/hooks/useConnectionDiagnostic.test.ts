// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectionDiagnostic } from "./useConnectionDiagnostic";

const THIRTY_SECONDS = 30_000;

describe("useConnectionDiagnostic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("does not show the diagnostic before 30s of disconnection", () => {
    const { result } = renderHook(() => useConnectionDiagnostic(false));

    expect(result.current.showDiagnostic).toBe(false);

    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS - 1);
    });

    expect(result.current.showDiagnostic).toBe(false);
  });

  it("shows the diagnostic after 30s of continuous disconnection", () => {
    const { result } = renderHook(() => useConnectionDiagnostic(false));

    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS);
    });

    expect(result.current.showDiagnostic).toBe(true);
  });

  it("auto-hides the diagnostic when the connection is restored", () => {
    const { result, rerender } = renderHook(
      ({ connected }) => useConnectionDiagnostic(connected),
      { initialProps: { connected: false } },
    );

    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS);
    });
    expect(result.current.showDiagnostic).toBe(true);

    rerender({ connected: true });
    expect(result.current.showDiagnostic).toBe(false);
  });

  it("cancels the pending timer when reconnecting before 30s elapse", () => {
    const { result, rerender } = renderHook(
      ({ connected }) => useConnectionDiagnostic(connected),
      { initialProps: { connected: false } },
    );

    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS - 1);
    });
    rerender({ connected: true });

    // Even after the original 30s would have elapsed, the timer was cleared.
    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS);
    });
    expect(result.current.showDiagnostic).toBe(false);
  });

  it("supports manual open and close independent of the timer", () => {
    const { result } = renderHook(() => useConnectionDiagnostic(false));

    act(() => {
      result.current.openDiagnostic();
    });
    expect(result.current.showDiagnostic).toBe(true);

    act(() => {
      result.current.closeDiagnostic();
    });
    expect(result.current.showDiagnostic).toBe(false);
  });

  it("clears the timer on unmount (no late state update)", () => {
    const clearSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = renderHook(() => useConnectionDiagnostic(false));

    unmount();

    expect(clearSpy).toHaveBeenCalled();

    // Advancing past the threshold must not throw or warn about a dead update.
    act(() => {
      vi.advanceTimersByTime(THIRTY_SECONDS);
    });
    clearSpy.mockRestore();
  });
});
