# Sidebar real icon + name; footer version only

## Goal

The main-window sidebar shows placeholder branding. Use the real project icon +
name at the top, and since the top now shows the name, drop the name from the
footer — keep only the version number there.

## What I already know

- `src/components/MainWindow.tsx` sidebar (~line 82-95):
  - TOP logo: a `<span>` "SC" text badge (30px, `bg-primary`) + `<b>scbox</b>`.
  - FOOTER: `SCBox Assistant{version ? ` v${version}` : ""}` (name + version) via `useAppVersion`.
- Real logo image exists at `src-tauri/icons/source.png` (1024×1024) and `/Users/noahcode/Downloads/scbox-logo-cue-1024.png`. The frontend has `src/assets/` (currently only react.svg). Tauri/Vite bundles imported assets from `src/`.
- Real product name = "SCBox Assistant" (tauri.conf productName).

## Decision

- TOP: replace the "SC" text badge with the real logo image (an `<img>` in the 30px rounded box) and change `<b>scbox</b>` → "SCBox Assistant".
- FOOTER: show ONLY the version (e.g. `v{version}`), no product name. If version is null, render nothing (or a subtle placeholder) — keep the mono muted style.
- Add the logo to the frontend assets (copy `src-tauri/icons/source.png` → `src/assets/logo.png`) and import it so Vite bundles it (no runtime path/CDN).

## Requirements

- Sidebar top shows the real logo + "SCBox Assistant".
- Sidebar footer shows only the version (no name).
- Logo bundled via import (works in packaged app).

## Acceptance Criteria

- [ ] Sidebar top renders the real icon image + "SCBox Assistant".
- [ ] Sidebar footer shows just `v{version}` (no product name); renders fine when version is null.
- [ ] tsc / vitest / coverage / cargo green; build ok (logo bundled).

## Out of Scope

- Other branding; the overlay; Windows verification.

## Technical Notes

- Copy `src-tauri/icons/source.png` to `src/assets/logo.png`, `import logo from "@/assets/logo.png"`, render `<img src={logo} alt="" className="size-[30px] rounded-lg" />` in place of the "SC" badge (keep the rounded box look; the logo already has rounded corners, so the wrapper rounding is fine).
- Keep `useAppVersion`; just change what the footer renders.
- No IPC/type/behavior changes.
