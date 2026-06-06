# In-app build order editor (+ supply→time helper)

## Goal

Let the user create/edit/delete build orders inside the app (visual CRUD over
steps, matchup/race selection, save = takes effect immediately) instead of
hand-editing JSON files in the OS app-data `builds/` dir. Bundle a supply→time
helper so steps can be authored by SC2 supply count (how builds are normally
remembered) rather than raw in-game-clock seconds.

## What I already know

- Data shape (cross-layer contract): `BuildOrder { matchup, race, leadTimeSec, steps: [{ time, say }] }`, camelCase on disk. Mirrored in `src/types/build.ts` and `src-tauri/src/builds.rs`.
- Builds live as `*.json` under the OS app-data `builds/` dir; seeded with `terran-standard.json` on first run.
- Rust today only has `load_from_dir` + `seed_if_empty` (exposed via `load_build_orders`). **No save/delete command exists yet.**
- `BuildOrder` carries no filename/id — runtime builds can't currently be mapped back to their source file. The editor needs an identity story.
- Existing UI surfaces are small overlay panels: `SettingsPanel.tsx`, `DiagnosticPanel.tsx`. The window is always-on-top / overlay-sized.
- Frontend loads builds via `useBuildOrders` hook (load + reload, fallback to bundled build on hard fail).
- Steps' `say` text already embeds supply by convention (e.g. "14 补给站").

## Assumptions (temporary)

- Editor is for the local user's own builds; no multi-user/cloud sync.
- A build file holds exactly one `BuildOrder` (matches current loader).

## Decisions

- **(Q1) Supply→time helper = Approach A (reference-table estimate).** A built-in approximate supply→seconds mapping for standard worker production. User enters a supply count, the helper suggests a `time`, which the user can fine-tune. Pure/testable, no game required. Live record-mode (B) is explicitly out of scope for this task (possible future extension).

- **(Q2) Persist `supply` per step = YES, as an additive optional field.** `BuildStep` gains `supply?: number` in both `src/types/build.ts` and `src-tauri/src/builds.rs` (serde optional → backward compatible; existing files without it still parse). `say` stays free-form text.

- **(Q3) Build↔file identity = Approach A.** The loader returns each build's source filename (wrapper `{ filename, build }`), new builds get an app-generated safe filename, and `save`/`delete` commands locate files by filename. On-disk JSON schema stays free of any id; multiple builds per matchup are supported.

- **(Q4) Editor UI surface = Approach A (separate editor window).** A dedicated, roomy Tauri 2 webview window opened on demand, so it doesn't cramp the always-on-top overlay. Requires a second window (label-based routing so the React app renders the editor view in that window).

- **(Q5) Reference-table fidelity = Approach A (simple linear).** `time ≈ startOffset + supply * secondsPerSupply` with sane Terran defaults. Pure/testable; user fine-tunes the suggested `time`. No piecewise curve, no configurable params for MVP.

- **(Q6) Save validation = Approach A (auto-sort + boundary validation).** On save, steps are sorted ascending by `time`. Boundary validation blocks save only on missing required fields / illegal values (`time < 0`, empty `say`, blank matchup/race) with a clear message. No silent JSON corruption.

## Requirements

- Separate editor window (Tauri label `editor`, opened on demand from the overlay; own capability file).
- List existing builds (matchup / race / filename); select one to edit.
- Create new build; delete existing build (with confirm).
- Edit `matchup`, `race`, `leadTimeSec`.
- CRUD over steps: add / edit / delete; each step has `time`, `say`, optional `supply`.
- Supply→time helper: enter `supply`, get a suggested `time` (simple linear), user-adjustable.
- Save writes back to the app-data `builds/` dir; the overlay picks up the change without restart (reuse `useBuildOrders` reload).
- Auto-sort steps ascending by `time` on save; boundary validation blocks invalid saves.

## Acceptance Criteria

- [ ] Opening the editor from the overlay shows a dedicated window listing current builds.
- [ ] User can create a new build, add steps (optionally via supply helper), save, and the overlay drives the new cues without restart.
- [ ] User can edit an existing build's steps/fields and save; changes persist to the correct file.
- [ ] User can delete a build (with confirm); it disappears from the overlay after reload.
- [ ] Steps are persisted in ascending `time` order regardless of entry order.
- [ ] Invalid input (empty say, negative time, blank matchup/race) is rejected with a clear message; no malformed JSON is written.
- [ ] `supply` round-trips: saved, reloaded, and shown on re-edit.

## Definition of Done

- Tests added/updated (lib-layer pure helpers unit-tested; Rust save/delete/sanitize unit-tested).
- Lint / typecheck / cargo + vitest green.
- Runs and verified on macOS (Windows verification deferred to end of overall iteration).

## Technical Approach

**Data model (additive):** `BuildStep` gains `supply?: number` in `src/types/build.ts` and `src-tauri/src/builds.rs` (serde optional, keep no `deny_unknown_fields` → existing files still parse).

**Identity:** `LoadResult` extended so each build carries its source `filename` (wrapper `StoredBuild { filename, build }`). `useBuildOrders` still exposes plain `BuildOrder[]` for scheduling consumers, plus the filename mapping for the editor. New builds get an app-generated safe filename (slug from matchup + uniqueness suffix).

**New Rust commands:** `save_build_order(filename, build)` (write pretty JSON to `builds/<filename>`), `delete_build_order(filename)` (remove file). Path-traversal guard: filename only, reject separators / `..`. Unit-test pure write/delete/sanitize helpers in `builds.rs`.

**Editor window:** declare a second window `editor` (hidden, larger, resizable) in `tauri.conf.json`; add `src-tauri/capabilities/editor.json` with needed window + invoke perms. Add an `open_editor` command (or JS `WebviewWindow`) to show/focus it. Route in `main.tsx` by `getCurrentWindow().label` → render `<BuildEditor>` for `editor`, `<App>` for `main`.

**Supply→time helper:** pure `src/lib/supplyTime.ts` (`supplyToTime(supply, model)`), unit-tested. Simple linear with Terran defaults.

**Validation/sort:** pure helper `src/lib/buildValidation.ts` that validates + returns a sorted, normalized `BuildOrder`; unit-tested. Editor state updates are immutable (new objects, never mutate steps).

## Implementation Plan (small PRs / phases)

- **PR1 — Data + backend:** add `supply?` to TS/Rust models; extend `LoadResult` with filename; add `save_build_order` / `delete_build_order` + filename sanitize/generate helpers; register commands; Rust unit tests. Keep `useBuildOrders` consumers compiling.
- **PR2 — Editor window plumbing:** declare `editor` window + capability; open/focus command; `main.tsx` label routing; minimal `<BuildEditor>` shell that lists builds.
- **PR3 — Editor UX + helpers:** full CRUD form, supply→time helper (`lib/supplyTime.ts`), validation+auto-sort (`lib/buildValidation.ts`), save/delete wiring, overlay reload on save; lib unit tests; macOS run-through.

## Out of Scope (explicit)

- Build import/export / sharing (separate backlog item).
- Cloud sync / multi-user.
- Live record-mode supply capture (Approach B) — possible future extension.
- Piecewise / configurable supply→time models.
- Windows real-machine verification (deferred to the very end per iteration plan).

## Technical Notes

- Immutability rule: editor state updates must produce new objects, never mutate steps in place.
- Validate at the boundary before writing JSON to disk.
- Main window label is `main` (default); capabilities are per-window — the editor needs its own capability file.
