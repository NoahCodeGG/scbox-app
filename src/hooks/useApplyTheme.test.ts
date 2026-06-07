// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useApplyTheme, type Theme } from "./useApplyTheme";

/** Listeners registered on the mocked matchMedia object, for firing changes. */
type ChangeListener = (event: MediaQueryListEvent) => void;

interface MatchMediaController {
  /** Set the current OS-dark match and notify subscribed listeners. */
  setMatches: (matches: boolean) => void;
  /** Number of `change` listeners currently subscribed (for cleanup asserts). */
  listenerCount: () => number;
}

/** Install a controllable `window.matchMedia` and return a handle to drive it. */
function installMatchMedia(initialMatches: boolean): MatchMediaController {
  let matches = initialMatches;
  const listeners = new Set<ChangeListener>();

  const mql = {
    get matches() {
      return matches;
    },
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_type: "change", listener: ChangeListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: "change", listener: ChangeListener) => {
      listeners.delete(listener);
    },
  };

  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mql),
  );

  return {
    setMatches: (next: boolean) => {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      for (const listener of listeners) listener(event);
    },
    listenerCount: () => listeners.size,
  };
}

describe("useApplyTheme", () => {
  beforeEach(() => {
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("adds the dark class for theme=dark and removes it for theme=light", () => {
    installMatchMedia(false);
    const { rerender } = renderHook(({ theme }) => useApplyTheme(theme), {
      initialProps: { theme: "dark" as Theme },
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    rerender({ theme: "light" });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("follows the OS match when theme=system", () => {
    installMatchMedia(true);
    renderHook(() => useApplyTheme("system"));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("does not darken on theme=system when the OS is light", () => {
    installMatchMedia(false);
    renderHook(() => useApplyTheme("system"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("re-applies when the OS appearance changes under theme=system", () => {
    const media = installMatchMedia(false);
    renderHook(() => useApplyTheme("system"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    media.setMatches(true);
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    media.setMatches(false);
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("removes the media listener on unmount and on theme change", () => {
    const media = installMatchMedia(false);
    const { rerender, unmount } = renderHook(
      ({ theme }) => useApplyTheme(theme),
      { initialProps: { theme: "system" as Theme } },
    );
    expect(media.listenerCount()).toBe(1);

    // Switching away from system tears down the subscription.
    rerender({ theme: "dark" });
    expect(media.listenerCount()).toBe(0);

    // Back to system re-subscribes; unmount must clean it up.
    rerender({ theme: "system" });
    expect(media.listenerCount()).toBe(1);
    unmount();
    expect(media.listenerCount()).toBe(0);
  });
});
