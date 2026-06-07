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

## Global light/dark theme

The app has a GLOBAL light/dark theme driven by a persisted `theme:
"light" | "dark" | "system"` setting (default `"system"`). It is applied by
toggling a `.dark` class on `document.documentElement` via the
`useApplyTheme(theme)` hook, which runs PER WINDOW (both the main window and the
overlay manage their own webview's `<html>`). For `"system"` the hook follows
`prefers-color-scheme: dark` and re-applies live on OS appearance changes.

- The dark variant is the standard global `@custom-variant dark (&:is(.dark *))`
  in `index.css`; the shadcn `.dark { --... }` palette activates the whole main
  window (dashboard/editor/settings). That palette IS the overlay dark-glass
  look (cyan accent), single-sourced from the `:root` `--ov-*` tokens: every
  `.dark` shadcn token references an `--ov-*` var (`--background`→
  `--ov-dark-surface`, `--card/--popover/--secondary/--muted/--accent`→
  `--ov-dark-raise`, fg→`--ov-dark-fg`, `--primary/--ring`→`--ov-accent-cyan`
  with `--primary-foreground: #06222a`, `--border/--input`→`--ov-dark-border`).
  So the main window and the overlay share the same dark surfaces + cyan accent.
  When changing dark surfaces/accent, edit the `--ov-*` source in `:root`, not
  the `.dark` block.
- The overlay's dark-glass follows the SAME global theme: `.dark .overlay-card`
  flips the `--ov-*` cyan tokens (the overlay no longer has its own Moon toggle
  or local `theme-dark` state).
- The theme is chosen on the Settings page (浅色/深色/跟随系统), persisted with
  the rest of `Settings`, and synced across windows via `SETTINGS_CHANGED_EVENT`
  (the Settings page and the MainWindow shell are separate `useSettings`
  instances, so MainWindow listens for the event and `reload()`s to re-apply).

Do NOT toggle `.dark` by hand — go through `useApplyTheme(settings.theme)`.


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
