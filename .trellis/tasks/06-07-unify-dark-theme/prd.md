# Unify app dark theme with the overlay dark-glass palette

## Goal

In dark mode the main window uses shadcn's neutral grayscale palette, while the
overlay uses a dark-glass look with a CYAN accent. Make the whole app's dark
theme consistent with the overlay by deriving the shadcn `.dark` tokens from the
same overlay `--ov-*` source.

## What I already know

- `src/index.css` `:root` defines the overlay dark source tokens: `--ov-dark-surface #0b0d10`, `--ov-dark-raise #15181d`, `--ov-dark-fg #f4f5f7`, `--ov-dark-muted #8a8f99`, `--ov-dark-border #262b33`, `--ov-accent-cyan #22d3ee`.
- The `.dark { ... }` block (~line 134) currently uses shadcn NEUTRAL dark values (grayscale oklch; `--primary` near-white). That's what the main window shows in dark mode — inconsistent with the overlay's cyan dark-glass.
- `.dark .overlay-card` already maps the overlay `--o-*` tokens to the `--ov-*` dark set (cyan accent, blur). Global `.dark` is toggled by the `theme` setting (useApplyTheme).

## Decision

- Rewrite the `.dark { ... }` shadcn token block so it derives from the overlay `--ov-*` tokens (single source), giving the main window the same dark-glass surfaces + cyan accent as the overlay:
  - `--background: var(--ov-dark-surface)`; `--card`/`--popover`: `var(--ov-dark-raise)`.
  - `--foreground`/`--card-foreground`/`--popover-foreground`/`--secondary-foreground`/`--accent-foreground`: `var(--ov-dark-fg)`.
  - `--muted`/`--secondary`/`--accent`: `var(--ov-dark-raise)` (subtle surfaces); `--muted-foreground`: `var(--ov-dark-muted)`.
  - `--primary`: `var(--ov-accent-cyan)`; `--primary-foreground`: `#06222a` (the overlay's accent-on dark teal); `--ring`: `var(--ov-accent-cyan)`.
  - `--border`/`--input`: `var(--ov-dark-border)`.
  - `--destructive`: keep a readable red. `--sidebar*` map to the same surfaces + cyan primary; `--chart*` can stay or use cyan-ish — keep readable.

## Requirements

- App dark mode (dashboard/editor/settings) visually matches the overlay dark-glass: same dark surfaces, cyan accent on primary/active/focus, light text.
- Light mode unchanged.
- Single source: `.dark` tokens reference `--ov-*` (no duplicated hex where a token exists).
- Contrast remains legible (text on surfaces, primary-foreground on cyan).

## Acceptance Criteria

- [ ] In dark mode, the main window surfaces + cyan accent match the overlay (active nav, buttons, focus rings use cyan; backgrounds use the overlay dark surfaces).
- [ ] Light mode unchanged; overlay unchanged.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Light-theme changes; new tokens; Windows verification.

## Technical Notes

- CSS-only: edit the `.dark { ... }` block in `src/index.css`. Reference `--ov-*` vars directly (they're in `:root`, always available). Hex literals are fine for the few values without a token (e.g. `--primary-foreground: #06222a`, destructive red).
- Keep all shadcn dark token KEYS present (background, foreground, card(+fg), popover(+fg), primary(+fg), secondary(+fg), muted(+fg), accent(+fg), destructive, border, input, ring, chart-1..5, sidebar*). Map each to the overlay palette consistently.
- Verify primary-foreground/cyan and text/surface contrast is legible.
- Update `.trellis/spec/frontend/ui-system.md` dark-theme note: the global `.dark` palette is the overlay dark-glass (cyan), single-sourced from `--ov-*`.
