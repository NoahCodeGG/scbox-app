# Redesign UI with shadcn/ui

## Goal

Re-skin the in-app screens (overlay, editor, settings) to match the user's new
HTML mockups using shadcn/ui (Tailwind + new-york/neutral), adopting the new
design system (Geist + Fira Code, black accent on neutral, mono for technical/
numeric content, optional dark-glass overlay theme) WITHOUT changing any wired
behavior (IPC commands, build CRUD, import/export, voice, update check, window
controls, interpolated clock).

## What I already know (from research/)

- Mockups live in `/Users/noahcode/Downloads/scbox-app/*.html` (8 files). See `research/mockups-catalog.md`.
  - IN scope (in-app): `overlay.html` (the real `.overlay` + light/`.theme-dark` variants, 4 states; a demo harness wraps it — only the `.overlay` artifact is real), `editor.html`, `settings.html`.
  - NET-NEW (deferred): `dashboard.html` (no main-window route exists), `onboarding.html` (no first-run flow).
  - OUT (marketing): `landing.html`, `scbox-overview.html`, `index.html` (index == overview byte-identical).
- Design tokens consolidated in `research/design-system.md`: black accent (#000) on white/neutral (#f4f4f5), Geist display/body + Fira Code mono (tabular-nums for numbers), radii 6/8/12, `--s*` spacing, `cubic-bezier(0.2,0,0,1)` motion, accent focus ring, success/warn/danger. Maps to shadcn new-york/neutral CSS variables. Overlay dark variant should be overlay-SCOPED, not a global `.dark`.
- Code mapping in `research/code-mapping.md`: only 2 Tauri windows — `main` (overlay = `App.tsx`) and `editor` (`BuildEditor.tsx`); settings is an in-overlay popover (`SettingsPanel.tsx`), not a window. Must preserve every hook/command/event listed there.
- Setup state in `research/shadcn-setup.md`: project has NO Tailwind/shadcn/`@/` alias today (plain CSS). Tailwind v3-vs-v4 + shadcn CLI specifics were NOT live-verified by research — MUST verify against ui.shadcn.com/docs/installation/vite before implementing. `csp: null` in tauri.conf (ok). Fonts must be bundled (no runtime CDN).
- Editor mockup is a SUBSET of today's editor (lacks sidebar list, opponent select, supply→time, delete-confirm, import/export) — re-skin must NOT drop those.

## Decisions

NOTE: AskUserQuestion timed out repeatedly; these are research-backed defaults the user can redirect.

- **(Q1) Scope = re-skin the 3 in-app screens only** (overlay, editor, settings). Defer dashboard + onboarding (net-new features → separate tasks) and marketing pages (not desktop-app). 
- **(Q2) Phased delivery**, riskiest last: Phase 0 foundation → Phase 1 settings → Phase 2 editor → Phase 3 overlay.
- **(Q3) No feature regression**: apply the new look while keeping ALL current capability (editor sidebar/opponent/supply→time/delete-confirm/import-export; overlay 4 states/clock/drag/click-through/update banner/diagnostic/voice hint).
- **(Q4) Defer net-new settings fields** (玩家名 playerName, 置顶显示 always-on-top toggle, reset-to-default) unless the user asks — they need backend wiring beyond a re-skin.
- **(Q5) Dark overlay theme = overlay-scoped tokens** (a class on the overlay root), not a global app dark mode.

## Requirements

- Add Tailwind + shadcn/ui (new-york, neutral, cssVariables), `@/` path alias (tsconfig + vite + vitest), `cn()` util, theme CSS variables from the design system, bundled Geist + Fira Code (`@font-face`, self-hosted `.woff2`).
- Re-skin `SettingsPanel`, `BuildEditor` (+ `BuildTransferPanel`), and the overlay (`App.tsx` + `DiagnosticPanel`) to the mockups using shadcn primitives.
- Preserve all behavior + cross-layer type contracts; no IPC/command/event/field changes.
- Keep `pnpm test` green (hook tests mock IPC; should be unaffected) and the `src/hooks/**` coverage gate.

## Acceptance Criteria

- [ ] Phase 0: Tailwind+shadcn installed; `@/` alias works in build + vitest; theme tokens + fonts in place; `pnpm build`/`tsc`/`vitest` green with no UI behavior change.
- [ ] Settings matches settings.html (grouped cards, Switch, Slider, Input); update-check row + version footer preserved.
- [ ] Editor matches editor.html's look AND retains sidebar list, matchup/opponent selects, supply→time estimate, step CRUD, delete-confirm, import/export, status banner.
- [ ] Overlay matches overlay.html (4 states, connection dot, clock, 3-step list, voice/firing animation, dark-glass variant) AND preserves drag region, click-through, interpolated clock, update banner, diagnostic modal, voice hint.
- [ ] All existing tests pass; coverage gate held; app builds; macOS run-through done per phase.
- [ ] No behavior/contract change (IPC, events, types).

## Definition of Done

- tsc / vitest / coverage / cargo green; `pnpm build` + `cargo build` ok.
- Each re-skinned surface verified on macOS (`pnpm tauri dev`).
- Fonts bundled (no external CDN at runtime).

## Technical Approach

- **Phase 0 (foundation)**: verify current shadcn/Vite docs; install Tailwind (version per docs) + `shadcn init` (components.json new-york/neutral/cssVariables); add `@/` alias to `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`; add `lib/utils.ts` `cn()`; translate design tokens → `:root` CSS vars + Tailwind theme; self-host Geist + Fira Code via `@font-face`; add base primitives (button input select switch slider card badge dialog label separator scroll-area). No component rewrites yet.
- **Phase 1 (settings)**: port `SettingsPanel` to shadcn cards/Switch/Slider/Input; keep update-check button + status + version footer; keep draft/save semantics.
- **Phase 2 (editor)**: port `BuildEditor` to the mockup's two-column layout; ADD the live JSON-preview pane + validity indicator from editor.html; preserve sidebar build list, matchup/opponent selects, supply→time, step CRUD, delete-confirm, `BuildTransferPanel`, status banner.
- **Phase 3 (overlay, riskiest)**: port `App.tsx` overlay + `DiagnosticPanel` to the mockup look incl. the 4 states, connection dot, clock (interpolated), upcoming-3 steps, firing animation, dark-glass `.theme-dark` (overlay-scoped). Preserve `data-tauri-drag-region`, click-through, update banner, voice hint. Re-validate the 320×200 `main` window fit — adjust `tauri.conf.json` size only if the design needs it (flag before changing).

## Implementation Plan (small PRs / phases)

- **PR0**: Tailwind + shadcn foundation + alias + tokens + fonts + primitives (no behavior change). Verify build + vitest.
- **PR1**: Settings re-skin.
- **PR2**: Editor re-skin (preserve all features; add JSON preview).
- **PR3**: Overlay + Diagnostic re-skin (+ dark-glass), window-size re-check.

## Out of Scope (explicit)

- dashboard.html, onboarding.html (net-new features → separate tasks).
- landing/scbox-overview/index marketing pages.
- New settings backend (playerName, always-on-top toggle, reset) unless requested.
- Behavior/IPC/type changes; Windows real-machine verification (deferred).

## Technical Notes

- The overlay demo harness/stage in overlay.html is throwaway; only the `.overlay` markup + state/theme CSS is the artifact.
- Keep cross-layer type field names/casing (serde mirror) untouched.
- Fonts: bundle `.woff2` + `@font-face`; system fallbacks already specified in the tokens.
- Re-verify Tailwind v3-vs-v4 + shadcn CLI against current docs (research couldn't live-verify).

## Research References

- [`research/mockups-catalog.md`](research/mockups-catalog.md) — 8 mockups cataloged; 3 in-app, 2 net-new, 3 marketing.
- [`research/design-system.md`](research/design-system.md) — tokens → shadcn theme mapping.
- [`research/code-mapping.md`](research/code-mapping.md) — mockups → components/hooks/commands to preserve.
- [`research/shadcn-setup.md`](research/shadcn-setup.md) — Tailwind+shadcn-in-Tauri setup (verify against docs).
- [`research/risks-and-scoping.md`](research/risks-and-scoping.md) — scope verdicts + phase plan.
