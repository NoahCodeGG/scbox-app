# Overlay click-through toggle button

## Goal

Add a 穿透模式 (click-through) toggle button to the overlay header so it can be
enabled directly from the overlay, not only from the main window Settings.

## What I already know

- `src/App.tsx` (overlay): `const { settings, saveSettings } = useSettings();`, `const passthrough = settings.clickThrough;`. `useWindowControls({ settings, saveSettings })` applies click-through (`setIgnoreCursorEvents`) when `clickThrough` changes. The header has an icon-button cluster (reload/edit/settings), each `className={iconBtn}` with `onMouseDown={(e) => e.stopPropagation()}` (so clicks work inside the drag region). lucide-react icons used.
- The global shortcut Ctrl+Shift+S emits `ui://toggle-clickthrough`; the overlay listens and turns click-through OFF (you can't click the overlay to disable it once clicks pass through).
- Saving settings emits `SETTINGS_CHANGED` so the main window stays in sync.

## Decision

- Add a click-through toggle Button to the overlay header icon cluster: a mouse-pointer icon (lucide e.g. `MousePointer2` / `SquareMousePointerDashed`), `onClick` → `saveSettings({ ...settings, clickThrough: !settings.clickThrough })`; active styling (accent color) when `passthrough` is on; `onMouseDown` stopPropagation (drag-region rule). `title`/`aria-label` "穿透模式（Ctrl+Shift+S 解除）".
- Enabling makes the overlay click-through; disabling is via the existing Ctrl+Shift+S (the button can't be clicked once passthrough is on) or the Settings toggle.

## Requirements

- A header button toggles `settings.clickThrough` (persisted via saveSettings, applied by useWindowControls, synced to the main window via SETTINGS_CHANGED).
- Active/pressed visual when click-through is on.
- Button is clickable (stopPropagation; not swallowed by the drag region).

## Acceptance Criteria

- [ ] Clicking the new overlay button enables click-through (overlay dims/passthrough); the existing Ctrl+Shift+S disables it; the Settings toggle stays in sync.
- [ ] Button shows an active state when click-through is on.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Changing click-through mechanics; the main window; Windows verification.

## Technical Notes

- Add the button in the overlay header cluster in `src/App.tsx`, mirroring the existing icon buttons (`iconBtn` class, `onMouseDown` stopPropagation, lucide icon). `aria-pressed={passthrough}`, accent class when active (like the removed Moon used `text-[color:var(--o-accent)]`).
- No new setting/IPC/type — reuse `settings.clickThrough` + `saveSettings`.
- No `any`, no console.log.
