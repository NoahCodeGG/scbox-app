# UI System (Tailwind v4 + shadcn/ui)

> The styling system for `scbox-app` after the redesign. Replaces the original
> per-component plain-CSS files.

---

## Stack

- **Tailwind v4** via the `@tailwindcss/vite` plugin (CSS-first — there is NO
  `tailwind.config.js`). Theme tokens live in `src/index.css` under
  `@theme inline` / `:root`.
- **shadcn/ui** (base color "neutral", `cssVariables: true`).
  Config in `components.json`. Generated primitives live in
  `src/components/ui/*` — treat these as vendored; don't hand-rewrite them, use
  `shadcn add` to update. The primitives are built on **Base UI
  (`@base-ui/react`)**, not Radix (the project migrated off `radix-ui`). Base
  UI's component structure and controlled-prop names differ from Radix — when
  touching a primitive, verify against the Base UI docs. Notably the `Slider`
  wrapper is generic over its value: pass a single `number` for a single-thumb
  slider (its `onValueChange` then yields a `number`), or a `number[]` for a
  range.
- `@/` path alias → `src/`, declared in `tsconfig.json`, `vite.config.ts`, AND
  `vitest.config.ts` (all three must agree or tests break). `cn()` is in
  `@/lib/utils`.
- Fonts are **self-hosted** via `@fontsource-variable/inter` (imported in
  `index.css`) + `@fontsource/fira-code` (imported in `main.tsx`). NEVER rely on
  a runtime CDN — the packaged app must work offline. Inter = display/sans, Fira
  Code = mono (used for clocks, times, ports, JSON — anything technical/numeric;
  pair with `tabular-nums`).

---

## Design tokens

Black accent (`--primary`) on white/neutral surfaces; `--success`/`--warning`/
`--destructive` for status; `--radius` ≈ 0.5rem. Use the token-backed Tailwind
classes (`bg-primary`, `text-muted-foreground`, `border`, `bg-success`, …) — do
not hardcode hex except inside the overlay's intentional dark-glass surface.

---

## Overlay-scoped dark theme (NOT a global dark mode)

The overlay (`main` window) supports a cyan dark-glass look that is **scoped to
the overlay card**, independent of any app-wide theme. It is wired via:

- `@custom-variant dark (.theme-dark *)` in `index.css`.
- Overlay-local CSS vars (`--o-surface/-raise/-fg/-muted/-border/-accent/...`)
  set on `.overlay-card`; `.theme-dark` overrides them to the `--ov-*` dark set
  + `backdrop-filter: blur()`.

Do NOT introduce a global `.dark` class — the editor/settings windows stay light.

---

## Re-skin rule (learned from the redesign)

When restyling a wired component: change ONLY the rendering. Preserve every
hook call, prop, IPC invoke, event name, and the cross-layer type field
names/casing. In particular for the overlay:

- The title bar MUST keep `data-tauri-drag-region`; interactive controls are
  children WITHOUT that attribute so they stay clickable. Making the whole card
  a drag region breaks all clicks.
- The drag bar MUST be `select-none` (`user-select: none`, inherits to child
  text spans) so dragging over its grip/matchup/race text starts the window
  drag instead of selecting text.
- Tauri only drags when the mousedown target element itself has
  `data-tauri-drag-region` (it does NOT walk up to ancestors), so the
  decorative left text container in the bar needs `pointer-events-none` to let
  the mousedown fall through to the bar and fire the drag.
- Keep `useInterpolatedClock` / `useBuildOrderVoice` / countdown math intact;
  any firing/speaking animation must be presentational only (never mutate the
  spoken set or the clock).

shadcn `Switch`/`Slider`/`Select` are controlled Base UI components: wire
`checked`/`onCheckedChange`, `value`/`onValueChange` (the `Slider` wrapper takes
a single `number` for the single-thumb case), mapping to the existing immutable
state updates.
