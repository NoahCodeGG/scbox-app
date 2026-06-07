# Themed titlebar for the main window (Overlay style)

## Goal

The main window uses the native macOS titlebar, which stays white and does NOT
follow the app's light/dark theme. Make the titlebar transparent/overlaid so the
themed background shows through (keeping the native traffic-light buttons), and
inset the content so it doesn't collide with the controls.

## What I already know

- `tauri.conf.json` `main` window has default decorations → a native (white, non-theming) titlebar with the title "SCBox Assistant".
- The app now has a global light/dark theme (`useApplyTheme` toggles `.dark`); the main window content (`MainWindow` `h-screen bg-secondary` container) is themed, but the native titlebar is not.
- macOS Tauri 2 supports `titleBarStyle: "Overlay"` + `hiddenTitle: true`: the titlebar becomes transparent and the window content draws under it, with the native traffic-light buttons floating top-left. The titlebar area then shows the themed app background → follows the theme.
- `MainWindow.tsx` sidebar logo sits top-left — exactly where the traffic lights would overlay; content needs a top inset there, plus a drag region for moving the window.

## Decision

- Set the `main` window to `titleBarStyle: "Overlay"` + `hiddenTitle: true` (macOS). Keep native traffic lights; the bar follows the theme.
- In `MainWindow`, add a draggable top region (`data-tauri-drag-region`) and inset the top content (especially the sidebar's top) below the traffic-light zone (~28px) so the logo/nav don't sit under the buttons.
- macOS-focused; on Windows `titleBarStyle` is ignored (native bar stays) — acceptable for now (Windows verification deferred).

## Requirements

- The main window's top bar follows the app theme (no white native bar in dark mode); native traffic lights remain functional.
- Window is still draggable by the top area; window controls (close/min/zoom) work.
- Sidebar logo + content are not obscured by the traffic lights (top inset).
- The overlay window is unaffected (already frameless/transparent).

## Acceptance Criteria

- [ ] In dark mode the top of the main window is dark (themed), not white; in light mode it's light. No separate native white titlebar.
- [ ] Traffic-light buttons are visible/usable and not overlapping the logo/nav.
- [ ] The window can be dragged by the top strip; resize/controls still work.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- A custom (decorations:false) titlebar with replicated controls; Windows titlebar theming; the overlay window.

## Technical Notes

- `tauri.conf.json` main window: add `"titleBarStyle": "Overlay"` and `"hiddenTitle": true`. VERIFY the exact Tauri 2 enum casing (`TitleBarStyle` = Visible|Transparent|Overlay) against the config schema/docs before setting.
- `MainWindow.tsx`: add `data-tauri-drag-region` to a top strip (so it stays movable) and add top padding so the sidebar logo clears the ~28px traffic-light zone (e.g. `pt-7`/`pt-8` on the sidebar nav, and ensure the main content area still lays out cleanly). Interactive controls (nav links/buttons) must NOT be inside a drag region (or use `pointer-events`/stopPropagation like the overlay) — but simplest is to make only an empty top strip the drag region.
- No IPC/type/behavior changes; this is window config + layout.
- The themed background under the titlebar comes from the existing `MainWindow` `bg-secondary` container extending to the top edge — ensure it does (no gap).
