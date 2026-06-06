# Overlay enhancements (drag, click-through, show next 2-3 steps)

## Goal

Make the always-on-top overlay usable during a real fullscreen/borderless SC2
game: let the user **drag it** to a good spot, optionally make it
**click-through** so it never steals game focus/clicks, and show the **next 2–3
upcoming steps** (not just one) so the player can read ahead. Builds on the
existing overlay in `App.tsx`.

## Background (verified)
- `App.tsx` renders a 320×200 always-on-top window (`tauri.conf.json` →
  `alwaysOnTop: true`). `BuildPanel` shows only the single `nextStep` + countdown.
- `src/lib/schedule.ts` has `nextStepIndex(order, spoken)` (lowest unspoken
  index). No "next N" helper yet. `useBuildOrderVoice` owns the `spoken` set and
  returns `{ nextStep, spokenCount }`.
- Capability `src-tauri/capabilities/default.json` currently grants only
  `core:default` + `opener:default`.
- A settings panel + gear button already exist (from #5).

## Tauri 2 realities (must handle)
- **Dragging**: use a `data-tauri-drag-region` element (HTML attribute) on a
  drag handle, OR `getCurrentWindow().startDragging()`. The drag region must NOT
  overlap interactive controls (gear button, settings inputs) or they become
  un-clickable. `core:default` includes `core:window:allow-start-dragging`, but
  verify; add explicitly if needed.
- **Click-through**: `getCurrentWindow().setIgnoreCursorEvents(true)` makes the
  whole window pass clicks through — which also means the user can't click the
  gear/drag/dismiss. So click-through MUST be toggleable by something that still
  works while it's on. Decision below. Needs `core:window:allow-set-ignore-cursor-events`
  (likely under `core:default`; add if not).

## Decisions (locked, autonomous)
| Topic | Decision |
|-------|----------|
| Drag | A slim top "title bar"/handle strip with `data-tauri-drag-region`; the gear and other buttons sit outside the drag region. Window stays `resizable`. |
| Click-through toggle | A "穿透" toggle in the settings panel (persisted in Settings as `clickThrough: boolean`, default false). Because enabling it disables in-window clicks, ALSO register a **global shortcut** (e.g. `CmdOrCtrl+Shift+S`) to toggle click-through back off, so the user is never locked out. Use `tauri-plugin-global-shortcut`. |
| Window position persistence | Persist the window position so a dragged location survives restart. Use Settings (`windowX`/`windowY`, nullable) updated on move/close, applied on startup. (Keep it simple; Tauri's window-state plugin is an alternative but adds a dep — prefer the existing settings file.) |
| Steps shown | Show the next **3** upcoming steps (configurable count via a pure `upcomingStepIndices(order, spoken, n)`); the imminent one highlighted, the following ones dimmed. |
| Compactness | Overlay stays compact; the multi-step list is small. The settings panel still toggles over it. |

## Requirements
* R1: A pure `upcomingStepIndices(order, spoken, count): number[]` in
  `schedule.ts` (next `count` unspoken indices, ascending); unit-tested.
* R2: A draggable handle (`data-tauri-drag-region`) that doesn't capture clicks
  meant for the gear/buttons.
* R3: Click-through toggle in settings (`clickThrough` persisted), applied via
  `setIgnoreCursorEvents`; a global shortcut toggles it off so the user can't get
  locked out. Add `tauri-plugin-global-shortcut` + its capability/permission.
* R4: Window position persists across restarts (via Settings `windowX`/`windowY`,
  nullable; applied on startup, saved on move/close).
* R5: Overlay shows the next 3 steps (imminent highlighted), still driven by the
  interpolated clock + effective lead time from #3/#5.

## Acceptance Criteria
* [ ] `upcomingStepIndices` unit-tested (fewer steps than count; all spoken →
      empty; ascending order; respects spoken set).
* [ ] Settings gains `clickThrough` + `windowX`/`windowY` (serde defaults; old
      files still load) — Rust ⇄ TS aligned; normalize handles them.
* [ ] Dragging the handle moves the window; gear/buttons remain clickable.
* [ ] Enabling click-through passes clicks through; the global shortcut toggles
      it back; no lock-out.
* [ ] Window reopens at its last position.
* [ ] Overlay shows up to 3 upcoming steps.
* [ ] `cargo test`, `tsc`, `pnpm build`, `pnpm test` green.

## Out of Scope
* In-app build editor (#7); opacity/theme controls (could be a later polish).
* Multi-monitor edge-clamping niceties (keep position as-is; just persist).

## Definition of Done
* Follows `.trellis/spec/tauri/*` (new plugin → capability/permission in
  `default.json`; command/contract synced) and `.trellis/spec/frontend/*`
  (typed invoke, immutable state, pure helper tested, function components).
* New permissions for window drag / ignore-cursor / global-shortcut are added to
  the capability file (least privilege).
* Cross-layer: Settings additions Rust serde ⇄ TS aligned.

## Technical Notes
- `tauri-plugin-global-shortcut` (Rust + `@tauri-apps/plugin-global-shortcut`):
  register `CmdOrCtrl+Shift+S` (or similar) in `setup()`; on trigger flip
  click-through off and persist. Add `global-shortcut:default` (or specific
  permissions) to the capability.
- `setIgnoreCursorEvents` / `startDragging`: call via
  `@tauri-apps/api/window` `getCurrentWindow()`. Verify `core:default` already
  permits these; if not, add `core:window:allow-set-ignore-cursor-events` and
  `core:window:allow-start-dragging`.
- Window position: read on startup from Settings and `setPosition`; on
  drag-end / close, read `outerPosition()` and persist. Keep writes debounced/
  on-close to avoid thrashing the settings file.
- Extend the #5 `normalizeSettings` to clamp/validate the new fields.
