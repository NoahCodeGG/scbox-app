# Research: shadcn/ui + Tailwind in Tauri 2 + Vite 6 + React 18 + TS

- **Query**: Current recommended shadcn/ui + Tailwind setup for this Vite project, plus Tauri-specific gotchas
- **Scope**: external (shadcn/Tailwind/Tauri docs) + internal (verifying current config)
- **Date**: 2026-06-07
- **VERIFICATION NOTE**: The Context7 and Exa MCP tools were NOT available in this agent's tool set, so version/CLI specifics below are from established knowledge and MUST be re-confirmed against `ui.shadcn.com/docs/installation/vite` and the Tailwind docs at implementation time. The internal config facts (current project state) are verified from the repo.

## Current project state (verified from repo)
- `package.json`: Vite `^6.0.3`, React `^18.3.1`, TS `~5.6.2`, `@vitejs/plugin-react ^4.3.4`, Vitest `^4.1.8` + `@vitest/coverage-v8`, jsdom `^29`, Testing Library. pnpm `10.12.1`. **No Tailwind, no PostCSS, no shadcn, no `class-variance-authority`/`tailwind-merge`/`clsx`/`lucide-react` today.**
- `vite.config.ts`: plain `react()` plugin, fixed port 1420, `clearScreen:false`. **No path-alias config and no `resolve.alias`.**
- `tsconfig.json`: bundler resolution, `"jsx": "react-jsx"`, strict, `noUnusedLocals/Parameters`. **No `baseUrl`, no `paths` (`@/` alias is NOT configured).**
- Styling today = plain per-component CSS files (`App.css`, `SettingsPanel.css`, etc.).
- `src-tauri/tauri.conf.json`: `app.security.csp = null` (no CSP enforced). No font/asset bundling configured beyond icons.

## shadcn CLI target (Tailwind v3 vs v4)
- shadcn/ui's CLI now supports **Tailwind v4** (and still v3). For a fresh setup the current `shadcn init` flow targets **Tailwind v4** with the `@tailwindcss/vite` plugin and CSS-first config (`@import "tailwindcss"` + `@theme` in CSS, no `tailwind.config.js` required), OR Tailwind v3 with a `tailwind.config.{js,ts}` + `postcss`. **Confirm which version the CLI scaffolds at install time** — this materially changes the steps below.
- Tailwind v4 path (recommended if confirmed): add `tailwindcss` + `@tailwindcss/vite`, put `@import "tailwindcss";` in the global CSS, define theme tokens via `@theme`/CSS variables. No `postcss.config` / `tailwind.config` needed.
- Tailwind v3 path (fallback): `tailwindcss postcss autoprefixer`, `npx tailwindcss init -p`, configure `content`, add `@tailwind base/components/utilities`.

## components.json (shadcn config)
A `components.json` is created by `shadcn init`. Expected fields for this project: `style: "new-york"`, `rsc: false` (Vite, not Next), `tsx: true`, `tailwind.baseColor: "neutral"` (matches the mockups' neutral/black palette), `tailwind.cssVariables: true`, and `aliases` (`components: "@/components"`, `ui: "@/components/ui"`, `lib: "@/lib"`, `utils: "@/lib/utils"`). Note the project already has `src/lib/` — shadcn's `utils.ts` (`cn()`) would land there.

## Path alias `@/` (MUST be added — not present today)
shadcn components import via `@/`. Two edits required:
1. `tsconfig.json`: add
   ```json
   "baseUrl": ".",
   "paths": { "@/*": ["./src/*"] }
   ```
   (shadcn docs also suggest adding these to `tsconfig.node.json` referenced project, or a base tsconfig.)
2. `vite.config.ts`: add `resolve.alias` for `@`:
   ```ts
   import path from "node:path";
   resolve: { alias: { "@": path.resolve(__dirname, "./src") } }
   ```
   (Vite docs / shadcn Vite guide use `@types/node` + `path.resolve`. `@types/node` may need adding as a devDep.)

## Dark-mode strategy
- shadcn default = **class strategy** (`.dark` on `<html>`), toggled manually (no next-themes in a non-Next app — use a small provider or direct class toggle).
- **App windows (editor/settings/dashboard) are light-only in the mockups** — an app-wide dark mode is NOT required by the design.
- **The overlay needs its own dark variant** (`.theme-dark`, cyan accent, blur). Recommendation: implement the overlay dark look as **overlay-scoped CSS variables** (mirroring the mockup's `--ov-*` tokens) toggled by a class on the overlay root, rather than the global shadcn `.dark`. This keeps the "dark glass over game" independent of any app theme and avoids dragging shadcn's full dark palette into the tiny overlay.

## Tauri-specific gotchas
- **CSP**: `tauri.conf.json` has `csp: null` (disabled), so inline styles / Tailwind injected styles / `style` attributes are unrestricted today. If a CSP is ever added, Tailwind's injected `<style>` and any `style-src 'unsafe-inline'` needs must be allowed. For now: no blocker, but note that shipping with `csp: null` is a security posture choice (out of re-skin scope).
- **Fonts (no runtime CDN in a packaged app)**: Geist and Fira Code are NOT installed on Windows/most macOS. Do NOT `@import` from Google Fonts at runtime (packaged app has no guaranteed network; also CSP-fragile). **Bundle the font files** (`.woff2`) as Vite assets and declare `@font-face` locally (e.g. `src/assets/fonts/` imported via CSS). Fira Code is OFL, Geist is OFL — both redistributable. The mockups already provide system fallbacks (`-apple-system`, `Segoe UI`, `ui-monospace`, `Menlo`) so the app degrades gracefully if bundling is deferred.
- **Multi-window single bundle**: `main.tsx` renders by `getCurrentWindow().label`. Tailwind/global CSS is shared across both windows — fine, but overlay-specific styles should be scoped so editor styling doesn't bloat/alter the overlay.
- **Overlay window size**: `main` is 320×200; mockup overlay is 328px wide + taller. Tailwind classes don't change this, but the layout must fit or `tauri.conf.json` width/height (and resize behavior) may need adjustment — flag for scoping.
- **`data-tauri-drag-region`**: must remain on the overlay title-bar element after re-skin (currently `App.tsx:153`).

## Vitest impact (low risk)
- Tailwind utility classes render fine under jsdom; class names are inert strings in tests. Existing hook tests (`src/hooks/*.test.ts`) mock Tauri (`src/test/tauriMocks.ts`) and assert behavior, not CSS — they should not break from a re-skin.
- If `@/` alias is added, **Vitest must resolve it too**: add the same `resolve.alias` to the Vitest/Vite config (shared `vite.config.ts` `resolve.alias` covers both since Vitest reads Vite config). Verify `vitest run` after adding the alias.
- Adding Tailwind does not require touching the test setup unless a component test imports the global CSS; current tests are hook-level.

## Recommended dependency additions (to confirm exact versions at install)
- Runtime: `tailwindcss` (+ `@tailwindcss/vite` if v4) , `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` (icons — mockups use inline Lucide-style SVGs), `tailwindcss-animate` (v3) or built-in (v4).
- Dev: `@types/node` (for `path` alias in vite config), PostCSS/autoprefixer only if Tailwind v3.
- Then `shadcn init` + `shadcn add` the needed primitives: `button`, `input`, `select`, `switch`, `slider`, `card`, `badge`, `dialog` (diagnostic), `separator`, `label`, `tabs`/`sidebar` (dashboard), `progress` (onboarding), `tooltip`.

## Caveats / Not Found
- **Tailwind v3-vs-v4 and exact shadcn CLI behavior were NOT live-verified** (Context7/Exa unavailable in this session). Re-check `ui.shadcn.com/docs/installation/vite` before implementing — the v4 CSS-first flow vs v3 config-file flow is the single biggest setup fork.
- Exact font license/redistribution and `.woff2` sourcing not verified here.
- No CI/lint config (eslint/prettier) inspected for Tailwind plugin needs.
