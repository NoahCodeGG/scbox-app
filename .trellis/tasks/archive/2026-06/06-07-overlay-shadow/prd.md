# Soften overlay card shadow halo

## Goal

Remove the translucent dark "background" halo the user sees around the overlay
card. It is the card's heavy drop shadow bleeding into the transparent,
content-fit overlay window and getting clipped.

## What I already know

- `src/App.tsx` overlay card (line ~362) has `shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]` — a 50px-blur, 55%-black shadow.
- The overlay window is transparent + sized to the card + `p-2` (8px) wrapper ring (`src/App.tsx` resize logic). The 50px shadow spreads far beyond the 8px ring and is clipped → a dark halo/box around the card.
- The card already has a `border` + `rounded-[14px]`, which define it over the game without a heavy shadow.

## Decision

- Replace the heavy shadow with a SUBTLE, tight shadow (or none) that fits within the small transparent ring so no dark halo shows. Keep the dark-theme card's own glow appropriate (its `.theme-dark` look in index.css uses backdrop-blur + its own box-shadow — check it doesn't reintroduce a big halo; soften if it does).
- Keep the border + rounded corners.

## Requirements

- Overlay card has no clipped dark-shadow halo against the transparent window (light theme AND dark theme).
- The card is still visually distinct (border/subtle shadow) over a game background.

## Acceptance Criteria

- [ ] No translucent dark band/halo around the overlay card in the transparent window (light + dark theme).
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Out of Scope

- Other overlay changes; window sizing logic (already content-fit).

## Technical Notes

- Light theme: change the `shadow-[...]` on the `.overlay-card` div in `App.tsx` to a subtle value (e.g. `shadow-[0_2px_8px_rgba(0,0,0,0.18)]`) or remove it.
- Dark theme: `.overlay-card.theme-dark` in `src/index.css` has its own `box-shadow` (a big `0 18px 50px -10px rgba(0,0,0,.7)`) — soften it the same way so the dark variant doesn't show a halo either.
- The `p-2` wrapper + resize math can stay; a small shadow fits within ~8px. (If you prefer, bump the wrapper to allow a slightly larger soft shadow, but keep the transparent area minimal so it doesn't capture extra clicks — prefer just softening the shadow.)
- No IPC/type changes.
