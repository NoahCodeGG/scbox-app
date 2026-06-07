# Two-window architecture: dashboard shell + launchable overlay

## Goal

Restructure the app to match the prototype's intended window model:
- **Main window** = a normal desktop window with a left **sidebar nav** routing
  between pages: 仪表盘 (Dashboard), Build Order (editor), 设置 (Settings).
- **Overlay window** = a SEPARATE always-on-top floating window, **hidden by
  default**, launched from the dashboard's "启动悬浮窗" button.

Today the architecture is inverted (the `main` window IS the overlay, the editor
is a 2nd window, settings is an overlay popover). Fix it while preserving all
wired behavior (IPC, build CRUD, voice, interpolated clock, window controls,
update check, diagnostics).

## What I already know

- Current windows (`src-tauri/tauri.conf.json`): `main` (360×340, alwaysOnTop, hidden) renders the OVERLAY (`App.tsx`); `editor` (900×700, hidden) renders `BuildEditor`. `main.tsx` routes by `getCurrentWindow().label` (main→App overlay, editor→BuildEditor).
- `open_editor` command shows the editor window; editor close → hide (reusable). Poll loop `handle.emit("sc2://game", …)` broadcasts to ALL windows. `BUILDS_CHANGED_EVENT` already syncs build edits across windows.
- Settings: loaded per-window via `useSettings` (load_settings on mount); saved via `save_settings`. The overlay consumes settings (voice/clickThrough/leadTime) + `useWindowControls` (drag/click-through/position) runs in the overlay.
- Mockups (in `/Users/noahcode/Downloads/scbox-app/`): `dashboard.html` = the main-window shell (sidebar: 仪表盘/Build Order/设置; dashboard cards: 连接状态, 当前对局, Build Order 自动匹配 list, 步骤预览; "启动悬浮窗" primary button; version in sidebar footer). `editor.html` + `settings.html` = the inner pages. `overlay.html` = the floating overlay (already re-skinned into App.tsx in the prior task).
- Existing re-skinned components to reuse: `App.tsx` (overlay), `BuildEditor.tsx` + `BuildJsonPreview` + `BuildTransferPanel`, `SettingsPanel.tsx`, `DiagnosticPanel.tsx`, all hooks, shadcn primitives, theme tokens.

## Target window/routing model

- `main` window: NORMAL window (not alwaysOnTop, larger e.g. ~1000×680, resizable, VISIBLE on launch). Renders `<MainWindow>` = sidebar nav + a router rendering Dashboard / Editor / Settings pages.
- `overlay` window: small (~360×340), alwaysOnTop, **hidden by default** (`visible:false`, NOT shown in setup). Renders the existing overlay UI. Shown via a new `open_overlay`/`show_overlay` command from the dashboard; close → hide (keep reusable).
- Remove the `editor` window entirely; the editor becomes a main-window route. `open_editor` command removed (or repurposed). `main.tsx` routes: label `main` → MainWindow, label `overlay` → Overlay.

## Decisions

- **(Q1) Routing = react-router** (HashRouter — no server in Tauri). Sidebar nav links to `/` (Dashboard), `/editor` (Build Order), `/settings`.
- **(Q2) Dashboard build list = manual override allowed.** The user can pick the active build on the dashboard, overriding auto-match. Stored as a persisted `activeBuildOverride: string | null` (filename, null = auto) in `Settings`; the overlay uses `override ?? auto-select(matchup)`.
- **(Q3) Settings / diagnostics / update check = consolidated into the main window** (Settings page + Dashboard connection card). The overlay keeps only minimal controls.
- **(Q4) Settings→overlay sync = add a `SETTINGS_CHANGED` frontend event.** After the main window `save_settings`, emit it so the overlay reloads settings (click-through, voice, lead-time, active-build override) live. (Mirror the existing `BUILDS_CHANGED_EVENT` pattern.)
- **(Q5) Onboarding = deferred** (not this task).
- **(Q6) Overlay launch UX**: the dashboard "启动悬浮窗" button toggles show/hide of the overlay window; overlay close = hide (reusable). Overlay hidden by default on app launch.

## Requirements

- `tauri.conf.json` windows: `main` → normal window (VISIBLE on launch, NOT alwaysOnTop, ~1000×680, resizable, title "SCBox Assistant"); add `overlay` → small (~360×340), alwaysOnTop, `visible:false`. REMOVE the `editor` window.
- `main.tsx` routing by label: `main` → `<MainWindow>` (sidebar + react-router pages), `overlay` → the overlay UI (current `App.tsx`, renamed/`<Overlay>`).
- `MainWindow`: sidebar (logo + 仪表盘/Build Order/设置 nav links with active state + version footer) and routed pages:
  - **Dashboard**: 连接状态 card (useGameSnapshot/status/port), 当前对局 card (players/matchup/clock), Build Order 自动匹配 list with manual override, 步骤预览 card, and the 启动悬浮窗 launch button.
  - **Editor**: the existing `BuildEditor` (now a page, not a window).
  - **Settings**: `SettingsPanel` adapted to a page (no popover/×; Save in-page), incl. update-check + version + a link/section for connection diagnostics.
- Rust: replace `open_editor` with `open_overlay` (show+focus the overlay window) and a way to hide it (`hide_overlay`, or overlay close = hide); show the `main` window on launch; move the position-restore + click-through close-handler + window-control perms to the `overlay` window. Add the `activeBuildOverride` field to `settings.rs` + `Settings` type.
- Move `useWindowControls` (drag/click-through/position) to the overlay; the main window is a normal OS window.
- Overlay: drop the settings popover + update banner; keep drag bar/clock/steps/voice/click-through; the gear icon focuses the main window's settings page (`open_main` or show+focus main + route). Diagnostics move to main.
- Preserve all IPC/commands/events/type field names except the additive `activeBuildOverride` (+ new `open_overlay`/`hide_overlay`/`open_main` commands and `SETTINGS_CHANGED` event).

## Acceptance Criteria

- [ ] Launching the app shows the MAIN window on the Dashboard; the overlay is NOT visible.
- [ ] Sidebar routes to Dashboard / Build Order / Settings within the one main window (react-router, active link styling).
- [ ] "启动悬浮窗" shows the overlay (always-on-top); toggling it / closing the overlay hides it; re-launch works.
- [ ] Overlay still drags, supports click-through (+ Ctrl+Shift+S), persists position, shows the interpolated clock + 3-step coaching + voice.
- [ ] Editing builds + changing settings in the main window reflect in the overlay live (BUILDS_CHANGED + SETTINGS_CHANGED).
- [ ] Manual build override on the dashboard changes what the overlay coaches; "auto" restores matchup-based selection.
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.
- [ ] No regression to build CRUD/import-export/voice/diagnostics; cross-layer contracts intact (only additive changes).

## Implementation Plan (small PRs / phases)

- **PR1 — window + routing skeleton (backend + shell)**: tauri.conf windows (main visible/normal, overlay hidden/always-on-top, remove editor); capabilities moved to the overlay; lib.rs setup shows main + overlay-scoped position/close-hide + `open_overlay`/`hide_overlay`/`open_main` commands (replace `open_editor`); `main.tsx` label routing → `<MainWindow>` (react-router shell with placeholder pages wrapping existing Editor/Settings) vs `<Overlay>`. Verify both windows render + build green. Install `react-router-dom`.
- **PR2 — dashboard + cross-window state**: Dashboard page cards; `activeBuildOverride` settings field (settings.rs + type) + manual override UI; `SETTINGS_CHANGED` event wiring (overlay reloads settings); overlay slimmed (gear→main, drop popover/update banner); settings page polish + diagnostics relocation. macOS run-through.

## Out of Scope (explicit)

- Marketing pages; onboarding; Windows real-machine verification.
- New features beyond the window split + manual override.

## Technical Notes

- Both windows get `sc2://game` (global emit) — keep. Each window loads settings independently → `SETTINGS_CHANGED` keeps them in sync.
- `useWindowControls` runs ONLY in the overlay now. Main window is a normal draggable OS window.
- Keep `BUILDS_CHANGED_EVENT`; add `SETTINGS_CHANGED` in `src/lib/events.ts`.
- Additive cross-layer change: `Settings.activeBuildOverride` must mirror in `settings.rs` (serde camelCase) + `useSettings` `Settings` type + defaults + normalize.

## Research References

- `.trellis/tasks/06-07-shadcn-redesign/research/*` — mockup catalog, code mapping, design system.

