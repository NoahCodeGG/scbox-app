# Overlay content-fit resize must measure full content, not just the card

## Goal

Enabling passthrough (and other states that show auxiliary surfaces) collapses
the overlay into a thin scrollbar sliver. The content-fit resize only measures
the card, so when extra elements render outside the card the window doesn't grow
to fit them and the content overflows (scrollbar). Resize to the FULL content.

## Root cause

`src/App.tsx` overlay: the content-fit `ResizeObserver` sizes the window to
`cardRef` (`card.offsetWidth/Height + 16`). But the card (`cardRef`) is only the
overlay card; the auxiliary surfaces — `settingsError`, the voice install hint,
`loadError`, parse `errors`, and the **passthrough hint** ("穿透模式开启 · 按
Ctrl+Shift+S 解除") — are siblings INSIDE `<main className="p-2">` but OUTSIDE the
card. When any of them appear (e.g. enabling passthrough shows the hint), `<main>`
grows taller than the card-sized window → the webview overflows and shows a
scrollbar; on the transparent frameless window this looks like a sliver.

## Decision

- Move the content-fit measurement from the card to the `<main className="p-2">`
  wrapper (which contains the card AND all auxiliary surfaces). Size the window
  to `main.offsetWidth × main.offsetHeight` (the `p-2` padding is already
  included in offsetWidth/Height, so no extra `+16`). Keep the ResizeObserver on
  this wrapper. The window then always hugs everything; no overflow/scrollbar in
  any state (live, waiting, passthrough hint, error/voice hints).

## Requirements

- Enabling passthrough (showing the hint) keeps the overlay correctly sized — no scrollbar/sliver; the hint is visible below the card.
- All auxiliary-surface states (settingsError / voice hint / loadError / parse errors / passthrough hint) fit without overflow.
- Live/waiting states still hug the card as before (no regression in empty-chrome behavior; shadow not clipped).

## Acceptance Criteria

- [ ] Toggling passthrough shows the dimmed card + the "穿透模式开启…" hint, with the window sized to fit both — no scrollbar/sliver.
- [ ] Other hint/error states fit too; no empty padding in the common (no-hint) case.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Click-through mechanics; other overlay changes; Windows verification.

## Technical Notes

- In `src/App.tsx`, attach the existing `cardRef` (rename to e.g. `contentRef`) to the `<main className="p-2">` element instead of the card div. In `applySize`, use `el.offsetWidth`/`el.offsetHeight` directly (drop the `wrapperPadding * 2` since the wrapper's own padding is included). Keep the `ResizeObserver` + `setSize(new LogicalSize(...))` + cleanup.
- The card keeps its shadow; the `p-2` padding on `<main>` already gives the shadow room and is now part of the measured size.
- No behavior/IPC/type changes; CSS/measurement only.
