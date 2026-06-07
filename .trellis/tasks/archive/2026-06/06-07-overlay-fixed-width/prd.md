# Overlay fixed width so hints don't change window width

## Goal

Toggling the overlay passthrough button changes the window WIDTH each click. The
auxiliary hint ("穿透模式开启 · 按 Ctrl+Shift+S 解除") is wider than the card, and
the content-fit resize measures the full content width — so showing/hiding the
hint widens/narrows the window. Give the overlay a fixed content width so only
height auto-fits.

## Root cause

`src/App.tsx` overlay: content-fit `ResizeObserver` sizes the window to the
`<main className="p-2">` wrapper's offset box (width AND height). The card is the
intended ~328px design width, but the auxiliary surfaces (passthrough hint,
error/voice hints) are siblings whose natural text width can EXCEED the card.
When a hint appears, `<main>` offsetWidth grows to the hint width → window widens;
when it hides, it narrows. Hence the width "adjusts a bit" on each passthrough
toggle.

## Decision

- Constrain the overlay content to a FIXED width (the mockup design width 328px)
  by wrapping the card AND the auxiliary surfaces in a `w-[328px]` column inside
  `<main className="p-2">`. The hints then WRAP within 328px instead of widening
  the window. The content-fit resize keeps width constant (328 + 16 padding =
  344) and only HEIGHT changes to fit hints — no width fluctuation.

## Requirements

- Toggling passthrough (or any hint/error appearing) does NOT change the window width; only height adjusts to fit.
- The overlay content stays at the 328px design width; hints wrap within it.
- Live/waiting states unchanged; no horizontal overflow/scrollbar.

## Acceptance Criteria

- [ ] Clicking the passthrough button repeatedly keeps the window width constant; the hint wraps within the card width; height grows/shrinks to fit.
- [ ] Card + content render at 328px; no regression in live/waiting/dark.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Other overlay behavior; Windows verification.

## Technical Notes

- In `src/App.tsx`, wrap the card `<div className="overlay-card ...">` and the auxiliary surfaces (settingsError / voice hint / loadError / parse errors / passthrough hint) in a single `<div className="w-[328px]">` column inside `<main className="p-2">`. Keep the content-fit ref (`contentRef`) on `<main>` (its offsetWidth becomes 328 + 16 = 344, constant). The card no longer needs to be content-width — it fills the 328px column (it's already effectively that wide).
- Ensure the hint/error blocks are block-level and wrap (they already use text wrapping); within a 328px column the long hint wraps to 2 lines instead of widening.
- Keep the existing initial window width (344) consistent with 328 + 16.
- No behavior/IPC/type changes; layout only. No `any`, no console.log.
