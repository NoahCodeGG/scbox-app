# Hook-layer unit tests to 80%

## Goal

Add real unit tests for the six untested React hooks and replace the placeholder
(fake `expect(true).toBe(true)`) `useConnectionDiagnostic` tests, establishing a
hook-testing harness (DOM env + Tauri mocks) so the frontend meets the project's
80% coverage bar.

## What I already know

- vitest currently runs in **`environment: "node"`** (vitest.config.ts), include `src/**/*.test.ts`. Pure libs are intentionally DOM-free ("unit-testable in the node test env" per their headers).
- **No `@testing-library/react`, no jsdom/happy-dom** installed.
- `src/hooks/useConnectionDiagnostic.test.ts` is a **placeholder**: 5 `expect(true).toBe(true)` fake tests — must be replaced with real ones.
- Untested hooks and their external deps to mock:
  - `useGameSnapshot` — `listen` (@tauri-apps/api/event) → setState on `GAME_EVENT`.
  - `useInterpolatedClock` — `setInterval` + `performance.now` + pure `interpolate`; re-anchor logic on snapshot changes.
  - `useSettings` — `invoke` (@tauri-apps/api/core) load/save + `normalizeSettings`.
  - `useVoiceCapability` — `initVoice` (lib/speech, touches speechSynthesis).
  - `useWindowControls` — `getCurrentWindow`/`availableMonitors` (@tauri-apps/api/window), `listen`, `invoke`, `onCloseRequested` (heaviest to mock).
  - `useBuildOrderVoice` — `speak`/`cancelAll` (lib/speech) + pure `schedule` helpers; spoken-set state machine, game-end reset, late-connect suppression.
- Existing tests: 113 passing (11 files). cargo 34.

## Decisions

- **(Q1) DOM env = per-file jsdom, pure libs stay node.** Hook test files declare `// @vitest-environment jsdom` (docblock) so they run in jsdom; pure-lib tests keep the default `node` env (honoring their DOM-free contract). NOTE: vitest 4 deprecated `environmentMatchGlobs`, so use the per-file docblock (or `test.projects`) — same effect. Install `jsdom`.
- **(Q2) Tauri mocks = `vi.mock` the api submodules.** Mock `@tauri-apps/api/{core,event,window}` explicitly; `listen` returns an unlisten fn while capturing the handler so tests can fire events; `invoke` and window methods are `vi.fn()` spies. Centralize in a shared test helper to avoid per-file duplication.
- **(Q3) Coverage = enforced, scoped to hooks.** Add `@vitest/coverage-v8` + a `test:coverage` script and a coverage threshold scoped to `src/hooks/**` = 80%. Don't impose a global threshold (would fail on still-untested App/components).

## Requirements

- Real behavior tests (renderHook + act, fake timers where needed) for: useGameSnapshot, useInterpolatedClock, useSettings, useVoiceCapability, useWindowControls, useBuildOrderVoice.
- Replace the placeholder `useConnectionDiagnostic.test.ts` with real timer-based tests (30s-disconnect shows; reconnect auto-hides; manual open/close; cleanup on unmount).
- A reusable Tauri/event/window mock helper.
- Coverage tooling with an 80% gate scoped to `src/hooks/**`.

## Acceptance Criteria

- [ ] Each of the 6 hooks + useConnectionDiagnostic has real tests covering main behavior, cleanup, and key edge paths (e.g. clock pause/freeze, voice game-end reset + late-connect suppression, settings load/save error).
- [ ] No `expect(true).toBe(true)` placeholders remain.
- [ ] `pnpm test` green; `pnpm test:coverage` passes with `src/hooks/**` ≥ 80%.
- [ ] Pure-lib tests still run in node (no DOM dependency introduced).

## Definition of Done

- tsc / vitest green; hooks coverage ≥ 80% enforced.
- Hook behavior unchanged (tests only; fix a hook only if a test reveals a real bug — flag it if so).

## Technical Approach

- **Deps (dev)**: `@testing-library/react`, `@testing-library/dom` (peer), `jsdom`, `@vitest/coverage-v8`.
- **vitest.config.ts**: keep default `environment: "node"`; add `coverage` config (provider v8) with `thresholds` keyed to `src/hooks/**` = 80% (lines/functions/statements/branches as feasible). Add `package.json` script `"test:coverage": "vitest run --coverage"`.
- **Shared mock helper** (e.g. `src/test/tauriMocks.ts` or inline `vi.mock` factories): controllable `invoke`, a `listen` that records `(event, handler)` and returns an unlisten spy + a way to fire a payload, and `getCurrentWindow`/`availableMonitors`/`onCloseRequested` spies.
- **Per-hook**:
  - useGameSnapshot: fire a GAME_EVENT payload → snapshot updates; unlisten called on unmount; refetch returns current.
  - useInterpolatedClock: fake timers; re-anchor on advancing display_time; freeze when display_time stalls; reset when not live; clears interval on unmount.
  - useSettings: invoke load resolves → normalized settings; load reject → error set; saveSettings success updates state + calls save_settings with normalized; save reject → error.
  - useVoiceCapability: mock `initVoice` resolving a tier → tier set, needsInstallHint when "none"; cancelled on unmount.
  - useWindowControls: setIgnoreCursorEvents called on clickThrough; toggle event → saveSettings with clickThrough:false; onCloseRequested → outerPosition/monitors → saveSettings with logical pos + invoke exit_app; listeners cleaned up.
  - useBuildOrderVoice: live → seeds initialSpokenSet (suppress backlog); due steps speak (when voiceEnabled) and advance spoken; voice off advances without speak; game end/result/replay → cancelAll + reset; cancelAll on unmount.

## Implementation Plan (small PRs / phases)

- **PR1**: deps + vitest coverage config + `test:coverage` script + shared Tauri mock helper; convert one hook (useSettings) as the harness proof; replace useConnectionDiagnostic placeholders.
- **PR2**: remaining hooks (useGameSnapshot, useInterpolatedClock, useVoiceCapability, useBuildOrderVoice, useWindowControls); reach ≥80% on `src/hooks/**`.

## Out of Scope (explicit)

- Component (App/BuildEditor) render tests beyond what hooks need.
- E2E/Playwright.
- Global coverage threshold (only `src/hooks/**` gated).
- Changing hook behavior (tests only).
- Windows verification (pure test infra; N/A).
