# Single-source app name + icon from the Rust backend

## Goal

Manage the app name and icon in ONE place (the Tauri config / bundled icon set)
and read them at runtime, instead of hardcoding "SCBox Assistant" in the
frontend and keeping a duplicate `src/assets/logo.png`.

## What I already know

- Name: `tauri.conf.json` `productName` = "SCBox Assistant" is the single source. `@tauri-apps/api/app` `getName()` returns it at runtime (same pattern as the existing `getVersion()` → `useAppVersion`). The sidebar currently HARDCODES "SCBox Assistant" in `MainWindow.tsx`.
- Icon: the bundle uses `src-tauri/icons/*` (e.g. `128x128.png`). The frontend currently displays a DUPLICATE copy `src/assets/logo.png` (added last task) — two sources.
- `useAppVersion.ts` is the hook pattern to mirror (getX → null until resolved, cancel-safe).
- `core:default` already grants `core:app:default` (covers `getName`/`getVersion`). Custom Rust commands need no extra capability.

## Decision

- **Name**: add `useAppName()` (mirror `useAppVersion`, using `getName()`); use it in the sidebar (and anywhere the name is hardcoded). Single source = `tauri.conf.json productName`.
- **Icon**: add a Rust command `app_icon()` returning a base64 PNG **data URL** built from `include_bytes!("../icons/128x128.png")` (the same icon set the bundle uses). Add a `useAppIcon()` hook (invoke once on mount, null until resolved). Render it in the sidebar `<img>`. REMOVE `src/assets/logo.png` + its import. Single source = `src-tauri/icons/`.

## Requirements

- Sidebar name comes from `getName()` (no hardcoded "SCBox Assistant" in the frontend).
- Sidebar icon comes from the Rust `app_icon` command (base64 data URL from the bundled icon); `src/assets/logo.png` removed.
- Graceful when name/icon read is pending or fails (render fallback / nothing, no crash).

## Acceptance Criteria

- [ ] Sidebar shows the real name via `getName()` and the icon via the Rust command.
- [ ] No hardcoded product name in `MainWindow.tsx`; `src/assets/logo.png` deleted and unimported.
- [ ] `app_icon` returns a valid `data:image/png;base64,...` URL from `src-tauri/icons/128x128.png`.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Out of Scope

- Window titles (already single-source in tauri.conf); the overlay; Windows verification.

## Technical Notes

- `useAppName.ts`: copy `useAppVersion.ts`, swap `getVersion` → `getName`. It's under `src/hooks/**` (coverage gate) — add a small test (mirror `useAppVersion.test.ts`, mock `@tauri-apps/api/app` `getName`).
- `useAppIcon.ts`: `invoke<string>("app_icon")` once on mount, cancel-safe, null on reject. Under the coverage gate — add a test mocking `@tauri-apps/api/core` invoke (mirror existing hook tests / tauriMocks).
- Rust `app_icon`: `#[tauri::command] fn app_icon() -> String` → `format!("data:image/png;base64,{}", BASE64.encode(include_bytes!("../icons/128x128.png")))`. Add the `base64` crate (e.g. `base64 = "0.22"`) to `src-tauri/Cargo.toml`; use the engine API (`base64::engine::general_purpose::STANDARD`). Register in `generate_handler!`. `include_bytes!` path is relative to `src/lib.rs` → `"../icons/128x128.png"`.
- MainWindow sidebar `<img src={icon ?? undefined} alt="" className="size-[30px] rounded-lg" />`; show the box empty/placeholder until loaded. Name `<b>{name ?? ""}</b>`.
- No behavior/IPC-contract changes beyond the additive `app_icon` command.
