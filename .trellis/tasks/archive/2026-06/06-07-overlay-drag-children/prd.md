# Overlay header text not draggable (drag-region child target)

## Goal

Dragging on the overlay header's left text (grip ⠿ / matchup / race) still
doesn't move the window (text selection is already fixed). Make that text area
drag the window.

## Root cause

Tauri 2's `data-tauri-drag-region` starts a window drag only when the
**mousedown target element itself** has the attribute — it does NOT walk up to
ancestor elements. The header text lives in child spans of the drag-region bar,
so a mousedown on them targets a child WITHOUT the attribute → no drag. The
empty bar area drags because the target there IS the bar div.

## What I already know

- `src/App.tsx` title bar (`data-tauri-drag-region` div, now also `select-none`) has a LEFT container `<div className="flex min-w-0 items-center gap-2">` with the grip span, `<MatchupLabel>`, and the race span (all decorative, non-interactive), and a RIGHT container with the icon buttons (interactive, already `stopPropagation`).

## Decision

- Add `pointer-events-none` to the LEFT text container so mousedown there passes through to the drag-region bar (whose target then has the attribute) → the window drags. The left side has no interactive elements, so this is safe. The RIGHT button cluster keeps pointer events and still clicks.
- (Equivalent alternative would be putting `data-tauri-drag-region` on every left child; `pointer-events-none` on the one container is simpler/robust. Choose pointer-events-none.)

## Requirements

- Dragging over the grip/matchup/race text moves the overlay window.
- Icon buttons still click; no text selection; nothing else changes.

## Acceptance Criteria

- [ ] Click-dragging the header text area moves the window.
- [ ] Icon buttons still work; overlay otherwise unchanged.
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Out of Scope

- Other overlay changes; IPC/type changes.

## Technical Notes

- Add `pointer-events-none` to the left container div in `src/App.tsx` (the `flex min-w-0 items-center gap-2` one). Keep `data-tauri-drag-region` + `select-none` on the bar and the buttons' `onMouseDown` stopPropagation.
- If `MatchupLabel` or a child sets its own `pointer-events`, ensure the container's none isn't overridden.
