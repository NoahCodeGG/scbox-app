# Frameless transparent overlay + clickable buttons

## Goal

Make the overlay window show ONLY the card (the red-boxed region), not a full
macOS window with title bar + empty white space, and fix the overlay top-bar
icon buttons that don't respond to clicks.

## What I already know

- Overlay window (`tauri.conf.json` label `overlay`): 360×340, alwaysOnTop, resizable, visible:false, WITH default decorations + opaque body → shows the macOS title bar ("SCBox Overlay") and a large empty white area below the card (screenshot).
- The overlay UI (`src/App.tsx`) renders `<main className="p-2">` → a `.overlay-card` div. The card has its own border/radius/shadow.
- **Bug**: the title bar `div` has `data-tauri-drag-region` (App.tsx:340) and the icon buttons (诊断/reload/edit/dark/settings) are its CHILDREN. On macOS the drag region intercepts mousedown so the buttons' `onClick` never fires → "点击没反应".
- `index.css` is shared by BOTH windows (main shell + overlay). `:root --background` is white; body has a background. The main window needs its opaque bg; the overlay needs a transparent bg so only the card shows.
- Capabilities: `overlay.json` has core:default + window-control perms (start-dragging, set-ignore-cursor-events, set-position, outer-position).

## Decisions

- **Frameless + transparent overlay window**: `decorations: false`, `transparent: true` (verify Tauri 2 macOS transparency needs `app.macOSPrivateApi: true` — set if required), `resizable: false`, alwaysOnTop true, visible:false. Drop the window shadow (the card already has one) if a config option exists.
- **Transparent root for the overlay**: body/#root background transparent so only the `.overlay-card` is visible; the MAIN window (MainWindow shell) must render its OWN opaque background container so it isn't affected (don't rely on a global body bg).
- **Content-fit sizing**: dynamically resize the overlay window to the card's measured size (ResizeObserver → `getCurrentWindow().setSize(LogicalSize)`), so there is NO empty area in any state (waiting banner vs 3 steps). Requires `core:window:allow-set-size` on the overlay capability.
- **Clickable buttons**: make the top-bar interactive controls opt out of the drag region — add `onMouseDown={(e) => e.stopPropagation()}` to each button (and the 诊断 button), OR restructure so the drag region wraps only the non-interactive left side. Either way: dragging still works on the bar's empty/left area AND every icon button clicks.

## Requirements

- Overlay window is frameless (no macOS title bar / traffic lights) and transparent — only the rounded card shows.
- Overlay window hugs the card (no empty space) across states; resizes when content changes (waiting → live 3-step, dark toggle, etc.).
- All overlay top-bar buttons work: 诊断 (openDiagnostic), reload, edit/settings (open_main), dark toggle. Dragging the bar still moves the window.
- The MAIN window (dashboard shell) is visually unchanged (still opaque, normal window).

## Acceptance Criteria

- [ ] Launching the overlay shows only the card — no window chrome, no empty white area.
- [ ] Window height tracks the card content (no clipping, no empty padding) in waiting and live states.
- [ ] Every overlay icon button responds to a click; the bar still drags the window.
- [ ] Main window unaffected (opaque dashboard).
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Out of Scope

- Overlay visual redesign beyond frameless/transparent/fit.
- Windows real-machine verification (deferred; transparency/decorations behave differently there but config is cross-platform).

## Technical Notes

- Transparent windows on macOS in Tauri 2 may require `app.macOSPrivateApi: true` — verify against docs and set if needed.
- Keep the drag region functional (frameless windows can ONLY move via the drag region).
- index.css change must not make the main window transparent — scope the opaque bg to the MainWindow container, make the shared body transparent.
- Add `core:window:allow-set-size` to `capabilities/overlay.json` for the resize.
- No IPC/type contract changes.
