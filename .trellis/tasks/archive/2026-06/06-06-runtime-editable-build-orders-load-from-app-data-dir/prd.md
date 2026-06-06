# Runtime-editable build orders (load from app data dir)

## Goal

Make the player's build orders **editable after the app is packaged**. Today
`src/App.tsx` imports `src/data/builds/terran-standard.json` at compile time, so
an installed build cannot be changed — breaking the core "user curates his own
build order" premise. Load build orders from the OS app-data dir, seeding a
default on first run.

## Decisions (locked, 2026-06-06)

| Topic | Decision |
|-------|----------|
| Read/write layer | **Rust commands** (`app_data_dir() + std::fs + serde_json`), called from the frontend via typed `invoke` |
| Reload model | **Load on startup + reload at each game start + a manual "Reload" button** (no file watcher) |
| On-disk layout | App-data `builds/` directory; first run seeds `terran-standard.json` (the existing placeholder) |
| Load command shape | `load_build_orders()` returns **all** builds found in `builds/` (a list), to pave the way for task #4 multi-matchup; this task's frontend uses the first entry |
| Corrupt/missing | Fall back to the bundled default + show a clear error in the overlay; never crash |
| Validation | Rust serde + frontend TS validation; never trust on-disk content |
| Write path | `save_build_order` is **out of scope here** (task #7); this task is read + seed only |

## Requirements

* R1: On first run, if the app-data `builds/` dir is empty/absent, seed it with
  the bundled default build JSON.
* R2: Rust command `load_build_orders()` reads every `*.json` in app-data
  `builds/`, parses/validates each, and returns the valid `BuildOrder` list;
  registered in `generate_handler!`.
* R3: Frontend loads build orders via typed `invoke` at startup, on each game
  start, and on a manual "Reload" button; uses the first build for now.
* R4: Missing dir / invalid JSON degrades gracefully — fall back to the bundled
  default and surface a visible error; no crash.
* R5: Editing an on-disk build file and reloading (button or next game) reflects
  the change without restarting the app.

## Acceptance Criteria

* [ ] Fresh install writes the default build JSON into app-data `builds/`.
* [ ] App reads the active build from app-data `builds/`, not the bundle.
* [ ] Editing the on-disk file then reloading reflects the change in the app.
* [ ] Missing/invalid file degrades gracefully (default + visible error), no crash.
* [ ] `load_build_orders` has Rust unit tests (valid dir, empty/missing dir,
      one invalid file among valid ones).

## Definition of Done

* `cargo build` + `cargo test` green; `npx tsc --noEmit`, `pnpm build`, `pnpm test` green.
* Follows `.trellis/spec/tauri/*` (command/invoke contract synced, Result<T,E>,
  capability for any new permission) and `.trellis/spec/frontend/*` (typed invoke,
  immutable state, no any, error surfaced not swallowed).

## Out of Scope

* In-app editor UI / write path (task #7).
* Multi-matchup auto-selection (task #4).
* Supply→time authoring helper (task #8).
* File-watcher live reload.

## Technical Notes

* Rust: `app.path().app_data_dir()`; create `builds/` on first run; bundle the
  default JSON into the binary (e.g. `include_str!`) for seeding + fallback.
* Frontend: replace the static `import` in `App.tsx` with an `invoke`-backed
  loader (likely a `useBuildOrders` hook returning `{ builds, error, reload }`),
  feeding the first build into `useBuildOrderVoice`.
* Keep the `BuildOrder` TS type (`src/types/build.ts`) and the Rust struct in
  sync — this is the cross-layer contract (see cross-layer-thinking-guide).

## Implementation Plan (small PRs)

* PR1 (Rust): `load_build_orders` command + first-run seed + handler registration
  + capability if needed; unit tests (valid / empty / one-invalid).
* PR2 (Frontend): `invoke`-backed loader hook, wire into `useBuildOrderVoice`,
  reload-on-game-start + manual "Reload" button + error display; frontend tests.
