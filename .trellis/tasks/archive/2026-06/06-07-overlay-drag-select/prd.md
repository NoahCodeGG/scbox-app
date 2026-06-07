# Overlay header drag region selects text instead of dragging

## Goal

Dragging the overlay over the LEFT side of the header (the grip + matchup "TvX"
+ race text) doesn't move the window — it selects the text instead. Make that
area drag the window.

## What I already know

- `src/App.tsx` overlay title bar (~line 369) is the `data-tauri-drag-region` div containing the grip `⠿`, `<MatchupLabel>`, and the race label text, plus the icon buttons on the right.
- The text is user-selectable, so a mousedown over it triggers browser text selection and the native window drag doesn't start.
- The icon buttons already work (they `stopPropagation` on mousedown from a prior fix).

## Decision

- Make the drag bar non-selectable: add `select-none` (CSS `user-select: none` / `-webkit-user-select: none`) to the title-bar drag-region div so dragging over the text moves the window instead of selecting. `user-select` inherits, so the child text spans are covered.

## Requirements

- Dragging anywhere on the header's non-button area (including over the grip/matchup/race text) moves the window.
- No text selection occurs when click-dragging the header.
- The icon buttons still click; nothing else changes.

## Acceptance Criteria

- [ ] Click-dragging the header text area moves the overlay window (no text selection).
- [ ] Icon buttons still work; overlay otherwise unchanged.
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Out of Scope

- Other overlay changes; IPC/type changes.

## Technical Notes

- Add `select-none` to the title-bar div's className in `src/App.tsx`. (Optionally also `cursor-grab` is already present.) Keep `data-tauri-drag-region` and the buttons' `onMouseDown` stopPropagation.
