# Build order import/export sharing

## Goal

Let a user share build orders with other players: export a build to a portable
artifact (file and/or clipboard text) and import one they received, validating
it before saving into the app-data `builds/` dir. Builds toward the product's
"distribute to other players" goal.

## What I already know

- Build shape: `BuildOrder { matchup, race, leadTimeSec, steps: [{ time, say, supply? }] }`, camelCase JSON on disk; one build per file under app-data `builds/`.
- The editor (`src/components/BuildEditor.tsx`, runs in its own `editor` window) already does CRUD and persists via `save_build_order` / `delete_build_order` Rust commands; `useBuildOrders` exposes `stored: StoredBuild[]` (filename + build).
- Validation already exists: `src/lib/buildValidation.ts` `validateBuild(DraftBuild)` returns a normalized `BuildOrder` or an error; filename generation in `src/lib/buildFilename.ts`.
- Rust `builds.rs` has `save_to_dir` (writes pretty JSON, `sanitize_filename` guard) and `load_from_dir`.
- Plugins present: `opener`, `global-shortcut`. **No dialog or clipboard plugin yet.** Adding native file pick or clipboard access means a new Tauri plugin (Cargo dep + `.plugin()` + capability permission) per [permissions.md](../../spec/tauri/permissions.md).

## Assumptions (temporary)

- Export/import operate on a single build at a time (the editor's selected build), not bulk.
- Imported builds go through the same `validateBuild` boundary before being saved.

## Decisions

- **(Q1) Transport = clipboard/text JSON.** Share builds as JSON text (paste into chat), not native files or a folder reveal. No file-dialog plugin.
- **(Q2) Copy mechanism = zero-plugin textarea.** An import/export panel with a `<textarea>`. Export fills it with the build JSON (user Cmd+C, plus a best-effort `navigator.clipboard.writeText` "复制" button that degrades gracefully if the webview blocks it). Import = paste into the same textarea. No `clipboard-manager` plugin — bulletproof and dependency-free, important since native webview APIs (e.g. `window.confirm`) proved unreliable.
- **(Q3) Import collision = always create a new file.** Each import writes a new file via `generateBuildFilename(matchup, existing)` (auto-suffixed, e.g. `tvp-2.json`); never overwrites. Duplicates are removed via the editor's delete.

## Requirements

- Export the editor's selected build as pretty-printed `BuildOrder` JSON (filename metadata stripped) into the panel textarea; a best-effort one-click copy.
- Import: paste JSON → parse + validate → save as a new build → editor list + overlay update (reload + `BUILDS_CHANGED_EVENT`).
- Imported JSON passes the same validation boundary; malformed/invalid input is rejected with a clear message and never written.

## Acceptance Criteria

- [ ] Selecting a build and clicking 导出 shows its JSON in the textarea; 复制 copies it (or the user can select+copy manually).
- [ ] Pasting valid JSON and clicking 导入 creates a new build that appears in the list and drives the overlay after reload.
- [ ] Importing the same build twice yields two files (auto-suffixed), not an overwrite.
- [ ] Invalid JSON (bad syntax, missing/empty matchup/race, non-numeric/negative time, bad supply) is rejected with a clear message; nothing is written.

## Technical Approach

- **No backend changes needed**: reuse `save_build_order` (writes + sanitizes) and `useBuildOrders.reload`. No new plugin, no new capability.
- **New pure helper** `src/lib/buildTransfer.ts`:
  - `exportBuildJson(build: BuildOrder): string` — `JSON.stringify` of the build (matchup/race/leadTimeSec/steps[, supply]), 2-space pretty, no filename.
  - `parseImportedBuild(text: string): { ok: true; build: BuildOrder } | { ok: false; error: string }` — `JSON.parse` (guarded), shape-guard it's an object, coerce its fields into a `DraftBuild` (numbers → strings), then delegate to the existing `validateBuild` so import reuses all validation + ascending-sort. Unit-tested.
- **Editor UI**: an import/export panel (collapsible or a section) in `BuildEditor.tsx` with the textarea + 导出 (fills from selected build) / 复制 / 导入 buttons, reusing the existing status banner for success/error. 导入 success path: `save_build_order` with a generated filename → `reload` + `emit(BUILDS_CHANGED_EVENT)` → success banner.

## Implementation Plan (small PRs / phases)

- **PR1**: `src/lib/buildTransfer.ts` (`exportBuildJson` + `parseImportedBuild`) + unit tests (valid, malformed JSON, non-object, missing/invalid fields, supply round-trip).
- **PR2**: wire the import/export panel into `BuildEditor.tsx` (textarea, export/copy/import buttons, status reuse, save+reload+emit); macOS run-through.

## Out of Scope (explicit)

- Bulk export/import of all builds at once.
- Native file dialogs / clipboard-manager plugin.
- Cloud sharing / registry / URLs.
- Overwrite-on-collision prompt (Q3 chose always-new).
- Windows real-machine verification (deferred).

## Technical Notes

- Reuse `validateBuild` so imported JSON can't corrupt the builds dir.
- Strip `filename` from exported JSON — it's loader metadata, not part of the on-disk build contract.
