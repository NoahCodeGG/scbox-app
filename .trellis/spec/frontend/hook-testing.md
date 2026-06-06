# Testing Hooks

> How to unit-test React hooks in `scbox-app`. Pure logic stays in `node`;
> hooks that touch the DOM or Tauri run in jsdom with mocked Tauri APIs.

---

## Stack

- `@testing-library/react` (`renderHook` + `act`), `jsdom`, `@vitest/coverage-v8`.
- Pure-lib tests (`src/lib/*.test.ts`) stay in the default `node` env — they are
  intentionally DOM-free. Do NOT add a jsdom docblock to them.

---

## Env: per-file jsdom docblock

vitest 4 removed `environmentMatchGlobs`. Select the DOM env per file with a
docblock at the very top of each hook test file:

```ts
// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
```

The global `vitest.config.ts` env stays `node`; only files with the docblock run
in jsdom. This keeps the bulk of (pure) tests fast and DOM-free.

---

## Tauri mocks: `vi.mock` the submodules

The frontend reaches Rust only via `invoke` / `listen` / window APIs, so mock
those submodules. Centralize in `src/test/tauriMocks.ts` (typed, no `any`):

- `invoke` → a `vi.fn()` you stub per test.
- `listen` → records `(eventName, handler)` and returns an unlisten spy; expose a
  `fireTauriEvent(payload)` so a test can drive the captured handler, and a
  handle to assert the unlisten spy ran on unmount.
- `getCurrentWindow` / `availableMonitors` / `onCloseRequested` / etc. → spies.

Mocks must mirror the **real cross-layer contract** (see
[../guides/cross-layer-thinking-guide.md](../guides/cross-layer-thinking-guide.md)):
import event-name constants from source (e.g. `GAME_EVENT` from `types/sc2`) so
they can't drift, and use the real command names/camelCase arg keys
(`save_settings` with `{ settings }`, `exit_app`, …).

---

## What to assert (real contracts, not "did not throw")

Tests must fail if the behavior breaks — assert returned values, spy call args,
and state transitions, plus the hook's **cleanup**:

- Timer hooks: `vi.useFakeTimers()` + a coordinated `performance.now` spy; assert
  exact interpolated/threshold values and that `clearInterval`/`clearTimeout`
  runs on unmount.
- Event hooks: fire the captured handler → assert state; assert the unlisten spy
  is called on unmount (StrictMode-safety).
- Command hooks: cover the resolve path AND the reject/error path.

Avoid placeholder/no-op tests (`expect(true).toBe(true)`) — they are banned by
[quality-guidelines.md](./quality-guidelines.md).

---

## Coverage gate (scoped)

Coverage is enforced only where it's meaningful today — the hook layer:

```ts
// vitest.config.ts
coverage: {
  provider: "v8",
  include: ["src/hooks/**"],
  thresholds: { "src/hooks/**": { lines: 80, functions: 80, statements: 80, branches: 80 } },
},
```

Run with `pnpm test:coverage`. Do NOT add a global threshold until the rest of
the frontend (App/components) is covered — it would fail the gate on unrelated,
still-untested code.
