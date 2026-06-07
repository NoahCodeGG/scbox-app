# Finish Base UI migration and remove unused Radix

## Goal

Complete the user's in-progress migration of the shadcn UI primitives from
Radix (`radix-ui`) to Base UI (`@base-ui/react`) so the project compiles and the
controls behave correctly, then remove the now-unused `radix-ui` dependency and
any other dead content the migration left behind.

## What I already know (working tree has the user's uncommitted migration)

- All `src/components/ui/*.tsx` primitives now import `@base-ui/react`; NO `radix-ui`/`@radix-ui` imports remain in `src/`. But `package.json` still lists `radix-ui` (now unused). `@base-ui/react@^1.5.0` was added; `components.json`, `src/index.css`, `src/lib/utils.ts` also changed. `@fontsource-variable/inter` was ADDED (possible font change to reconcile vs the existing `@fontsource/geist-sans`).
- The migration does NOT compile — `pnpm tsc --noEmit` fails with:
  1. `src/components/SettingsPanel.tsx:209` — `value[0]` on a `number | readonly number[]`: Base UI's `Slider` value/onValueChange type differs from Radix (Radix was `number[]`).
  2. `src/components/ui/scroll-area.tsx:3` — unused `React` import.
- Consumers still use Radix-shaped props: `<Switch onCheckedChange>`, `<Slider value=[x] onValueChange={(v)=>v[0]}>`, `<Select value onValueChange>` + `SelectTrigger/SelectValue/SelectContent/SelectItem`. Base UI's APIs for these differ — the primitive wrappers must either present a compatible shadcn-like API OR the consumers must be updated. tsc only caught 2 errors but other prop/behavior mismatches may exist (Base UI ≠ Radix).

## Decisions

- Make the migration CORRECT and COMPILING: align the `ui/*` wrappers' APIs with Base UI's real component APIs (verify against the Base UI docs), and update consumer call sites (SettingsPanel/BuildEditor/Dashboard) only as needed to match. Prefer keeping the wrappers' external API shadcn-like so consumer churn is minimal.
- Remove `radix-ui` from `package.json` (+ lockfile). Remove any other now-dead deps/code (e.g., if a font was swapped, drop the unused one; if `tw-animate-css`/cva/clsx/tailwind-merge are still used keep them).
- Reconcile the font: determine whether the sans font is now Inter or Geist (check `index.css` font-family + `@theme`), keep ONE consistently, and remove the unused `@fontsource*` package. Update `frontend/ui-system.md` if the font choice changed.

## Requirements

- `pnpm tsc --noEmit`, `pnpm test`, `pnpm test:coverage` (src/hooks/** ≥80%), `pnpm build`, `cargo test`, `cargo build` all green.
- Every migrated control works per its Base UI API: Switch (voiceEnabled/clickThrough toggles), Slider (voiceRate, value↔number), Select (race/opponent in the editor), Dialog (diagnostic), Button/Input/Card/Badge/Label/Separator/ScrollArea render + behave.
- `radix-ui` removed; no unused deps left from the migration; one font kept.
- No behavior/IPC/type-contract changes (this is a UI-library swap + cleanup).

## Acceptance Criteria

- [ ] Project compiles + builds; all gates green.
- [ ] No `radix-ui` in package.json/lockfile; no `@radix-ui`/`radix-ui` imports anywhere.
- [ ] Slider/Switch/Select/Dialog wired correctly to Base UI APIs (values flow, toggles fire) at every call site.
- [ ] Exactly one sans font dependency kept (the one actually referenced); the other removed.
- [ ] No new `any`/console.log; primitives + consumers typed.

## Out of Scope

- New UI features; the border/shadow consistency pass (separate); Windows verification.
- Changing IPC/types/behavior.

## Technical Notes

- Verify each Base UI primitive's API against the Base UI docs (component names + controlled props differ from Radix). Fix the wrapper or the consumer, whichever is wrong.
- Slider: Base UI's value/onValueChange likely yields `number | number[]`; normalize in the consumer (e.g. `Array.isArray(v) ? v[0] : v`) or configure the wrapper for single-thumb number values.
- Run a dead-dep check (`pnpm dlx knip` or `depcheck`, or grep) to confirm what's truly unused before removing.
- The migration is the user's uncommitted WIP; complete it on top — final commit covers the whole base-ui migration + cleanup.
