// Shared Tauri/event/window mock helpers for hook tests (jsdom env).
//
// Tauri's `@tauri-apps/api/{core,event,window}` modules are mocked per test
// file via `vi.mock(...)` (hoisted). Because the factory passed to `vi.mock`
// must be self-contained, each test file points the mock at the spies exported
// here. This module owns the spies + a small event registry so a test can fire
// a payload to whatever handler the hook registered with `listen`.

import { vi } from "vitest";

/** A captured `listen` registration: the event name and its handler. */
interface ListenRegistration<T = unknown> {
  event: string;
  handler: (event: { payload: T }) => void;
}

// Registries are module-level so the (hoisted) vi.mock factories can read them.
const listenRegistrations: ListenRegistration[] = [];
const unlistenSpies: Array<() => void> = [];

/** The `invoke` spy. Stub its resolution per test with `mockResolvedValue` etc. */
export const invokeMock = vi.fn();

/**
 * The `listen` spy. Records (event, handler) and resolves to an unlisten spy.
 * Mirrors `@tauri-apps/api/event`'s `listen` signature closely enough for hooks.
 */
export const listenMock = vi.fn(
  (event: string, handler: (e: { payload: unknown }) => void) => {
    listenRegistrations.push({ event, handler });
    const unlisten = vi.fn();
    unlistenSpies.push(unlisten);
    return Promise.resolve(unlisten);
  },
);

// --- window spies -----------------------------------------------------------

export const setIgnoreCursorEventsMock = vi.fn(() => Promise.resolve());
export const outerPositionMock = vi.fn(
  (): Promise<{ x: number; y: number }> => Promise.resolve({ x: 0, y: 0 }),
);
export const onCloseRequestedMock = vi.fn();

/** Minimal shape of a Tauri `Monitor` used by the window-controls hook. */
export interface MockMonitor {
  position: { x: number; y: number };
  size: { width: number; height: number };
  scaleFactor: number;
}

export const availableMonitorsMock = vi.fn(
  (): Promise<MockMonitor[]> => Promise.resolve([]),
);

/** The object returned by `getCurrentWindow()`. */
export const currentWindowMock = {
  setIgnoreCursorEvents: setIgnoreCursorEventsMock,
  outerPosition: outerPositionMock,
  onCloseRequested: onCloseRequestedMock,
};

export const getCurrentWindowMock = vi.fn(() => currentWindowMock);

// --- controls ---------------------------------------------------------------

/** Reset every spy + registry. Call in `beforeEach` so tests stay isolated. */
export function resetTauriMocks(): void {
  listenRegistrations.length = 0;
  unlistenSpies.length = 0;
  invokeMock.mockReset();
  listenMock.mockClear();
  setIgnoreCursorEventsMock.mockReset();
  setIgnoreCursorEventsMock.mockReturnValue(Promise.resolve());
  outerPositionMock.mockReset();
  outerPositionMock.mockReturnValue(Promise.resolve({ x: 0, y: 0 }));
  onCloseRequestedMock.mockReset();
  availableMonitorsMock.mockReset();
  availableMonitorsMock.mockReturnValue(Promise.resolve([]));
  getCurrentWindowMock.mockClear();
}

/**
 * Fire a payload to the handler registered for `event`. Throws if no handler is
 * registered, so a mis-typed event name fails loudly in the test.
 */
export function fireTauriEvent<T>(event: string, payload: T): void {
  const reg = listenRegistrations.find((r) => r.event === event);
  if (!reg) {
    throw new Error(`No listen handler registered for event "${event}"`);
  }
  reg.handler({ payload });
}

/** The unlisten spy for the most recent `listen` registration. */
export function lastUnlistenSpy(): (() => void) | undefined {
  return unlistenSpies[unlistenSpies.length - 1];
}

/** How many `listen` registrations are currently recorded. */
export function listenRegistrationCount(): number {
  return listenRegistrations.length;
}
