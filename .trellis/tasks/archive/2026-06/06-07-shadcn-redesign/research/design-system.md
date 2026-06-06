# Research: Design System (shared tokens → shadcn/ui theme)

- **Query**: Consolidate shared design tokens across the 8 mockups and map them to a shadcn/ui theme
- **Scope**: external (extracted from the mockup `<style>` blocks)
- **Date**: 2026-06-07

## Findings

All 8 mockups declare the SAME token block in `:root` (minor per-file subsets). The system is described in the showcase as "Design System · shadcn", new-york-ish, **neutral base**, **black accent**.

### Color tokens (light = default)
| Token | Value | shadcn mapping |
|---|---|---|
| `--bg` | `#ffffff` | `--background` |
| `--surface` | `#ffffff` | `--card` / `--popover` |
| `--fg`, `--fg-2` | `#111827` | `--foreground`, `--card-foreground` |
| `--muted`, `--meta` | `#64748b` (slate-500) | `--muted-foreground` |
| `--border`, `--border-soft` | `#e5e7eb` (gray-200) | `--border`, `--input` |
| `--accent` | `#000000` | `--primary` |
| `--accent-on` | `#ffffff` | `--primary-foreground` |
| `--accent-hover` | `color-mix(in oklab, accent, white 10%)` | hover state of primary |
| body bg (editor/settings/dashboard) | `#f4f4f5` (zinc-100) | `--muted` / app chrome bg |
| `#fafafa` | titlebar / group headers | `--secondary` / subtle surface |
| `--success` | `#16a34a` (green-600) | semantic — add custom `--success` |
| `--warn` | `#d97706` (amber-600) | semantic — add custom `--warning` |
| `--danger` | `#dc2626` (red-600) | `--destructive` |

Note: accent is pure black `#000000` (not a hue). shadcn `--ring` should follow `--accent`.

### Overlay dark variant tokens (overlay.html only)
| Token | Value | Notes |
|---|---|---|
| `--ov-dark-surface` | `#0b0d10` | overlay dark bg (with `transparent 8%` + blur) |
| `--ov-dark-raise` | `#15181d` | raised bar bg |
| `--ov-dark-fg` | `#f4f5f7` | text |
| `--ov-dark-muted` | `#8a8f99` | muted text |
| `--ov-dark-border` | `#262b33` | border |
| `--ov-accent-cyan` | `#22d3ee` (cyan-400) | dark-mode accent (replaces black) |
| `--ov-game-1/2/3` | `#0a1419 / #14202b / #1f3340` | faux-game stage bg only (demo, discard) |

The dark code-block tokens (used in editor JSON preview and onboarding code box): bg `#0b0d10`, fg `#e7e9ec`, syntax `.k #7dd3fc`, `.s #a7f3d0`, `.n #fcd34d`, `.p #64748b/#475569`.

### Typography
- `--font-display`: `"Geist","Geist Sans", -apple-system, system-ui, "Segoe UI", Arial, sans-serif` — headings (`h1,h2,h3`), `letter-spacing:-0.02em`.
- `--font-body`: same Geist stack (in most files `--font-body: var(--font-display)`).
- `--font-mono`: `"Fira Code", ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Monaco, Consolas, monospace`.
- **Heavy mono usage** for all technical/numeric content: clocks, countdowns (with `font-variant-numeric: tabular-nums`), matchup labels, ports, paths, JSON, badges, section eyebrow labels (uppercase, `letter-spacing:.06em`), filenames. The `.mono` utility class = `font-family:var(--font-mono); font-variant-numeric:tabular-nums`.
- Base body: 16px, line-height 1.5, `-webkit-font-smoothing:antialiased`.
- Font-size scale (overlay.html): `--text-xs 12 / -sm 14 / -base 16 / -lg 20 / -xl 24 / -2xl 32`.

### Radii
`--radius-sm 6px`, `--radius-md 8px`, `--radius-lg 12px`, `--radius-pill 9999px`. Cards/windows use 12–14px. shadcn `--radius` base ≈ `0.5rem` (8px); set `--radius: 0.5rem` and derive sm/lg per shadcn convention, or set `--radius: 0.75rem` to favor the 12px cards.

### Spacing scale
`--s1 4 / --s2 8 / --s3 12 / --s4 16 / --s5 20 / --s6 24 / --s8 32 / --s12 48` (overlay also names `--space-1..8`). Maps directly to Tailwind spacing (1,2,3,4,5,6,8,12).

### Shadows / elevation
- `--elev` / `--elev-raised`: `0 1px 2px ... , 0 1px 3px ...` via `color-mix` of fg — subtle card lift.
- Window shadow: `0 24px 60px -24px rgba(0,0,0,.35)`.
- Overlay shadow: `0 18px 50px -12px rgba(0,0,0,.55)` (light) / `-10px ...,.7` (dark).

### Motion
- `--motion-fast 150ms`, `--motion-base 200ms`, `--ease cubic-bezier(0.2,0,0,1)`.
- Named animations: `pulse` (connection dot), `fire` (step announce scale), `spin` (loaders).

### Focus ring
`--focus-ring: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent)` — a 2px offset ring in accent color. Applied via `:focus-visible{box-shadow:var(--focus-ring)}`. Maps to shadcn `--ring` + `focus-visible:ring-2 ring-offset-2`.

## Suggested shadcn theme (CSS variables, neutral base, new-york)
Use shadcn's `:root` / `.dark` HSL (or oklch) convention. Light values:
```
--background: 0 0% 100%;            /* #fff */
--foreground: 222 47% 11%;          /* #111827 */
--card / --popover: 0 0% 100%;
--card-foreground: 222 47% 11%;
--muted: 240 5% 96%;                /* #f4f4f5 chrome bg */
--muted-foreground: 215 16% 47%;    /* #64748b */
--border / --input: 220 13% 91%;    /* #e5e7eb */
--primary: 0 0% 0%;                 /* black accent */
--primary-foreground: 0 0% 100%;
--secondary: 0 0% 98%;              /* #fafafa */
--destructive: 0 72% 51%;           /* #dc2626 */
--ring: 0 0% 0%;
--radius: 0.5rem;                   /* or 0.75rem for 12px cards */
/* custom semantic (not in default shadcn): */
--success: 142 71% 35%;             /* #16a34a */
--warning: 32 95% 44%;              /* #d97706 */
```
**App-window dark mode is OPTIONAL** — the mockups for editor/settings/dashboard are light only. The only dark surface required is the **overlay's `.theme-dark`**, which uses a distinct cyan accent (`#22d3ee`) rather than shadcn's standard dark palette. Recommend scoping the overlay-dark tokens as overlay-local CSS variables (mirroring the mockup's `--ov-*` block) rather than the global shadcn `.dark` class, so the overlay's "dark glass over a game" look is independent of any app-wide theme toggle.

## Caveats / Not Found
- Mockups define tokens as raw hex; converting to shadcn's HSL/oklch values above is approximate — verify exact conversions at implementation time.
- Geist + Fira Code are NOT system fonts on Windows; they must be bundled (see shadcn-setup.md "fonts").
- No explicit `--secondary-foreground`, `--accent` (shadcn's hover-surface), or chart tokens are defined in mockups; pick sensible neutral defaults from shadcn's neutral preset.
