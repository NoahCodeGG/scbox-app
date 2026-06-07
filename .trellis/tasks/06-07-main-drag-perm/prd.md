# Main window not draggable — missing start-dragging permission

## Goal

After switching the main window to an overlay titlebar with a custom
`data-tauri-drag-region` strip, the window can't be dragged. Fix the missing
capability permission so the drag region works.

## Root cause

`data-tauri-drag-region` calls `startDragging`, which requires
`core:window:allow-start-dragging` on the window's capability. During the
window-architecture restructure, the window-control perms were moved off the
`main` capability (to the `overlay` capability), since the main window was then a
normal OS-titlebar window. Now that the main window uses a custom drag strip
(Overlay titlebar), `src-tauri/capabilities/default.json` (windows: ["main"])
lacks `core:window:allow-start-dragging`, so the drag is denied at runtime.

## What I already know

- `capabilities/default.json` (main): core:default, opener:default, global-shortcut:default, updater:default, process:allow-restart — NO window perms.
- `capabilities/overlay.json` (overlay): has `core:window:allow-start-dragging` (+ other window perms) — the overlay drags fine.
- The drag strip exists in `MainWindow.tsx` (`data-tauri-drag-region` top strip) but is denied without the permission.

## Decision

- Add `core:window:allow-start-dragging` to `capabilities/default.json` (main window). That's the only permission the main window's drag region needs (it doesn't do click-through/position/etc.).

## Acceptance Criteria

- [ ] The main window can be dragged by the top drag strip.
- [ ] No over-granting (only `allow-start-dragging` added to main; not the full window-control set).
- [ ] cargo build/test green (validates the permission name); tsc/vitest/build green.

## Out of Scope

- Other windows; Windows verification.

## Technical Notes

- Add `"core:window:allow-start-dragging"` to the `permissions` array in `src-tauri/capabilities/default.json`. `cargo build` validates the name.
- No code/IPC changes; capability-only.
