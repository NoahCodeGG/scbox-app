# Research: Risks & Scoping Inputs

- **Query**: Call out scope boundaries, risks, and a suggested phase breakdown for the shadcn re-skin
- **Scope**: synthesis of the other three research files
- **Date**: 2026-06-07

## Scope classification (which mockups belong in a desktop re-skin)

| Mockup | Verdict | Reason |
|---|---|---|
| `overlay.html` | IN — re-skin (highest risk) | Maps to `main` window / `App.tsx`. Core product. |
| `editor.html` | IN — re-skin | Maps to `editor` window / `BuildEditor.tsx`. |
| `settings.html` | IN — re-skin | Maps to `SettingsPanel` (popover today). |
| `dashboard.html` | OUT of pure re-skin — NET-NEW feature | No window/route/component exists. Implies a new multi-page main window. |
| `onboarding.html` | OUT of pure re-skin — NET-NEW feature | No first-run flow / persisted flag / detect UI exists. |
| `landing.html` | OUT — marketing website | Not an app window. |
| `scbox-overview.html` | OUT — design showcase | Prototype index. |
| `index.html` | OUT — duplicate of overview | Byte-identical to scbox-overview.html. |

## Key risks

1. **Overlay re-skin is the riskiest.** Tiny window (320×200 in `tauri.conf.json` vs 328px+ mockup), always-on-top, `data-tauri-drag-region`, click-through (`settings.clickThrough` + Ctrl+Shift+S global shortcut). Must preserve: drag region attribute, interpolated clock, 4 visual states, voice/firing animation, the optional dark-glass theme. The mockup's overlay is taller than 200px — may force a window-size/resize change in `tauri.conf.json` (flag for decision; tauri.conf edits are out of THIS research's write scope but in scope for implementation).
2. **Behavior must not change.** The re-skin must keep every wired IPC/command/event: `load_build_orders`, `save_build_order`, `delete_build_order`, `load_settings`, `save_settings`, `open_editor`, `exit_app`, updater flow, `sc2://game` + `BUILDS_CHANGED_EVENT`. Type contracts (`GameSnapshot`, `BuildOrder`, `Settings`, etc.) must keep field names/casing (serde mirror).
3. **Editor: mockup is a SUBSET.** Mockup lacks the sidebar build list, opponent select, supply→time estimate, delete-confirm, and import/export that exist today. Re-skin must ADD the mockup's JSON-preview pane WITHOUT dropping existing capability. Risk = accidental feature regression.
4. **Settings adds fields with no backend:** 玩家名 (playerName) and 置顶显示 (always-on-top) are net-new (always-on-top is hardcoded in tauri.conf). 还原默认 (reset) is net-new UI over existing defaults. Decide whether to scope these in or defer.
5. **Settings as window vs popover.** dashboard.html nav treats settings as a routed page; today it's an in-overlay popover. Coupled to the dashboard decision.
6. **Net-new features (dashboard, onboarding)** require backend/feature work (a visible main window with routing, a first-run flag, connection-detect wiring) — much larger than a re-skin. Recommend separate tasks.
7. **Fonts.** Geist + Fira Code must be bundled (`.woff2` + `@font-face`), no runtime CDN. System fallbacks exist so graceful if deferred.
8. **Setup unknowns.** Tailwind v3 vs v4 / shadcn CLI behavior not live-verified (see shadcn-setup.md). `@/` alias must be added to `tsconfig.json` + `vite.config.ts` (and thus Vitest). Low test risk otherwise.

## Suggested phase breakdown

- **Phase 0 — Foundation (setup).** Add Tailwind + shadcn (`init`), `components.json` (new-york, neutral, cssVariables), `@/` alias in tsconfig + vite (verify `vitest run` still green), `cn()` util, theme CSS variables from design-system.md, bundle Geist + Fira Code via `@font-face`. Add base primitives (`button input select switch slider card badge dialog label separator`). No UI behavior change yet.
- **Phase 1 — Settings panel re-skin.** Port `SettingsPanel` to shadcn (grouped cards, `Switch`, `Slider`, `Input`). Keep update-check row + version footer. Defer/decide on playerName, always-on-top, reset-to-default. Smallest, lowest-risk surface; validates the token system.
- **Phase 2 — Editor re-skin.** Port `BuildEditor` to the two-column shadcn layout, ADD live JSON preview pane + validity indicator, while preserving sidebar list, opponent select, supply→time, delete-confirm, and `BuildTransferPanel` import/export.
- **Phase 3 — Overlay re-skin (riskiest, do last).** Port `App.tsx` overlay to the mockup `.overlay` look incl. 4 states, connection dot, 3-step list, voice/firing animation, and the dark-glass `.theme-dark` variant (overlay-scoped tokens). Preserve `data-tauri-drag-region`, interpolated clock, click-through, update banner, diagnostic modal, voice hint. Re-validate the 320×200 window fit (possible `tauri.conf.json` size tweak).
- **Phase 4 (optional, separate tasks) — NET-NEW features.** dashboard (new main-window route + sidebar nav) and onboarding (first-run wizard + persisted flag + detect). Scope independently; these are features, not re-skin.

## Caveats / Not Found
- Whether the product wants a full main-window dashboard (vs the overlay being the only main window) is a product decision not answerable from code.
- tauri.conf.json window-size changes for the overlay are flagged but not designed here.
