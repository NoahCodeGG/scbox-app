# Overlay resize feedback loop collapses window to a sliver

## Goal

Enabling passthrough collapses the overlay into a thin scrollbar sliver. Fix the
content-fit resize so it measures the fixed-width content column (intrinsic
328px) instead of the window-filling `<main>` — eliminating the
scrollbar-driven width feedback loop.

## Root cause

`src/App.tsx`: the content-fit `ResizeObserver` ref (`contentRef`, line 305) is
on `<main className="p-2">` (line 380), a BLOCK element whose `offsetWidth` =
the window's inner content width (minus any scrollbar), NOT the content's
intrinsic width. The actual fixed-width content is the inner `<div className=
"w-[328px]">` (line 385). The failure mode:
1. Passthrough toggles → the hint appears → `<main>` height briefly exceeds the
   window → a vertical scrollbar appears.
2. The scrollbar reduces `<main>.offsetWidth` by ~15px → `setSize` shrinks the
   window width by ~15px.
3. Narrower window → content still overflows → scrollbar persists → measure
   again (even narrower) → `setSize` again …
4. Runaway shrink → the window collapses to a ~15px sliver (the scrollbar).

## Decision

- Move the content-fit measurement ref from `<main>` to the inner `w-[328px]`
  column (intrinsic 328px, independent of the window/scrollbar). Compute
  `width = column.offsetWidth + 16` and `height = column.offsetHeight + 16` (the
  `<main>` `p-2` = 8px on each side). The measured width is then a constant 344,
  immune to scrollbars → no feedback loop, no sliver.
- Defensively set the overlay root to not scroll: `html, body, #root { overflow: hidden; }` in `index.css` (the overlay should never show a scrollbar; the main window scrolls inside its own `overflow-auto` container, so this is safe for it).

## Requirements

- Toggling passthrough (and any hint appearing) never collapses or shrinks the overlay; width stays 344, height fits content; no scrollbar.
- Live/waiting/dark states unchanged.

## Acceptance Criteria

- [ ] Enabling/disabling passthrough repeatedly keeps the overlay correctly sized (no sliver, no shrink, no scrollbar); the hint shows and height adjusts.
- [ ] Width is constant; height auto-fits.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Other overlay behavior; Windows verification.

## Technical Notes

- In `src/App.tsx`: put `ref={contentRef}` on the `<div className="w-[328px]">` column (typed `HTMLDivElement`) instead of `<main>`. In `applySize`, `width = Math.ceil(el.offsetWidth) + 16; height = Math.ceil(el.offsetHeight) + 16` (re-add the wrapper padding now that we measure the inner column, not `<main>`). Keep the ResizeObserver/observe/cleanup.
- `src/index.css`: add `overflow: hidden` to the existing `html, body, #root { background: transparent; }` rule (or a sibling rule) so the overlay can't show a scrollbar. Verify the MAIN window still scrolls (its content area uses `overflow-auto` within `h-screen`, so global `overflow: hidden` on body doesn't break it).
- No behavior/IPC/type changes; measurement + CSS only. No `any`, keep the existing console.error catch.
