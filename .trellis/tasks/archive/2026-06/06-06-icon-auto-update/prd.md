# App icon + auto-update

## Goal

Replace the scaffold icons with the user's real logo, and add a Tauri 2
auto-update channel so distributed (Windows) users can receive new versions:
updater plugin + in-app check/prompt, signed release artifacts, and a CI release
flow publishing a `latest.json` endpoint on GitHub Releases.

## What I already know

- Source logo provided: `/Users/noahcode/Downloads/scbox-logo-cue-1024.png` (1024×1024 RGBA PNG). `tauri icon <src>` regenerates the whole `src-tauri/icons/` set.
- No updater plugin yet (`Cargo.toml` has opener + global-shortcut). `tauri.conf.json` has no `plugins.updater` block; `bundle.targets: "all"`.
- Repo: `git@github.com:NoahCodeGG/scbox-app.git`. CI `build-windows.yml` builds an UNSIGNED Windows .msi/.exe artifact on push-to-main + workflow_dispatch; **no Release**.
- productName "SCBox Assistant", version 0.1.0 (tauri.conf.json + Cargo.toml), identifier `com.scbox-app.app`.
- Distribution target: other players, **Windows-primary**. macOS is dev-only; CI builds Windows only.

## How Tauri 2 auto-update works (for reference)

- `tauri-plugin-updater` (Rust) + `@tauri-apps/plugin-updater` (JS): `check()` → `update.downloadAndInstall()` → relaunch.
- Update artifacts must be **signed**: a keypair from `tauri signer generate`. The **public** key goes in `tauri.conf.json` `plugin.updater.pubkey`; the **private** key + password are CI secrets (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`).
- Endpoint: a `latest.json` manifest. With GitHub Releases, `tauri-action` (given `tagName`/`releaseId` + the signing secrets) builds, signs, generates `latest.json`, and uploads everything to the Release. Updater endpoint → `https://github.com/NoahCodeGG/scbox-app/releases/latest/download/latest.json`.
- `bundle.createUpdaterArtifacts: true` enables the signed update artifacts.

## Decisions

- **(Q1) Keypair = the USER generates & holds it.** I wire everything with a committed PLACEHOLDER public key (a throwaway pubkey so config/build stays valid) and provide exact commands; before the first real release the user runs `pnpm tauri signer generate`, replaces `plugin.updater.pubkey` with THEIR public key, and adds `TAURI_SIGNING_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub secrets. The production private key never passes through the assistant or the repo.
- **(Q2) Platforms = Windows + macOS.** The release workflow builds on a matrix (windows-latest + macos-latest); both upload signed updater artifacts to one Release and tauri-action merges `latest.json`.
- **(Q3) UX = check-on-launch + prompt-to-install, plus a manual "检查更新" button in Settings.** Never silent; user confirms before download/install/relaunch. Defensive (offline / placeholder pubkey → caught, no crash).
- **(Q4) Release = tag-driven.** Pushing a `v*` tag → build + sign + create a GitHub Release with `latest.json`. The existing `build-windows.yml` stays as the unsigned test-artifact build on main.

## Requirements

- **Icon**: regenerate `src-tauri/icons/*` from `/Users/noahcode/Downloads/scbox-logo-cue-1024.png` via `pnpm tauri icon`; keep a copy of the source in-repo for future regen.
- **Updater deps**: `tauri-plugin-updater` (+ `tauri-plugin-process` for relaunch) in Cargo; `@tauri-apps/plugin-updater` + `@tauri-apps/plugin-process` in package.json; register both in `lib.rs`.
- **Config**: `plugins.updater` with `pubkey` (placeholder) + `endpoints: ["https://github.com/NoahCodeGG/scbox-app/releases/latest/download/latest.json"]`; `bundle.createUpdaterArtifacts: true`.
- **Capability**: add the minimal `updater` + `process` (relaunch) permissions to the main window's capability.
- **In-app**: a `useUpdateCheck` hook (`@tauri-apps/plugin-updater` `check()`), an overlay prompt when an update is available ("新版本 vX 可用 [更新]") that downloads+installs then relaunches (`@tauri-apps/plugin-process`), and a "检查更新" button in `SettingsPanel`. All paths try/catch → no crash offline or with the placeholder key.
- **CI**: new `.github/workflows/release.yml` on `v*` tags, matrix [windows-latest, macos-latest], tauri-action with `tagName` + signing secrets, publishing one Release + `latest.json`.
- **Docs/handoff**: a clear checklist of the user's manual steps (generate keypair → replace pubkey → add 2 secrets → bump version → push `v*` tag).

## Acceptance Criteria

- [ ] New icon appears in the dev app + bundle (macOS verifiable); source PNG kept in repo.
- [ ] Updater + process plugins compile and are registered; capability grants them.
- [ ] `pnpm tauri dev` boots; the update check runs and FAILS GRACEFULLY (placeholder pubkey/offline) with no crash and no uncaught rejection.
- [ ] When `check()` reports an update, the overlay shows a prompt; the Settings "检查更新" button triggers a check.
- [ ] `useUpdateCheck` is unit-tested (mocked plugin: update-available, none, error) and the `src/hooks/**` coverage gate holds.
- [ ] `release.yml` exists, is tag-triggered, matrix Windows+macOS, references the signing secrets, and creates a Release with `latest.json`.
- [ ] Handoff checklist documents the user's keypair/secret/tag steps. No private key committed.
- [ ] tsc / vitest / cargo green; `cargo build` ok.

## Technical Approach

- **Icon**: `pnpm tauri icon <src>`; store source at e.g. `src-tauri/icons/source.png` (or `assets/`). Commit regenerated PNG/ICNS/ICO.
- **Rust** (`lib.rs`): `.plugin(tauri_plugin_updater::Builder::new().build())` + `.plugin(tauri_plugin_process::init())`. No command changes.
- **Config**: add `plugins.updater` + `bundle.createUpdaterArtifacts: true`. PLACEHOLDER pubkey is a real (throwaway) base64 so the config is schema-valid and dev runs cleanly; mark it `# REPLACE` in a comment/handoff (JSON can't comment — document in the handoff + PRD).
- **Frontend**: `src/hooks/useUpdateCheck.ts` → `{ available: boolean; version: string | null; install: () => Promise<void>; check: () => Promise<void>; error: string | null }`. On mount runs `check()` once (cancel-safe). `install()` = `update.downloadAndInstall()` then `relaunch()`. Overlay renders a prompt in `App.tsx`; Settings adds a button. Types strict, no `any`.
- **CI** `release.yml`: `on: push: tags: ['v*']`; jobs matrix `os: [windows-latest, macos-latest]`; steps mirror build-windows (pnpm/node/rust/cache, tests), then `tauri-apps/tauri-action` with `tagName: ${{ github.ref_name }}`, `releaseName`, `releaseDraft: true` (user publishes), env `TAURI_SIGNING_PRIVATE_KEY` / `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. `permissions: contents: write` (to create the release).

## Implementation Plan (small PRs / phases)

- **PR1 — icon**: regenerate icons from source + keep source in repo.
- **PR2 — updater plumbing**: deps (Cargo + npm), plugin registration, config (`plugins.updater` + `createUpdaterArtifacts` + placeholder pubkey), capability perms. `cargo build` + `pnpm tauri dev` boot clean.
- **PR3 — in-app + CI + handoff**: `useUpdateCheck` + tests, overlay prompt + Settings button, `release.yml`, and the user handoff checklist (keypair/secrets/tag). macOS run-through.

## Out of Scope (explicit)

- Generating/holding the production signing private key (user does this).
- Windows code signing / SmartScreen (separate; paid cert).
- Publishing an actual Release (user does, after adding secrets) — so true end-to-end update is verified by the user, not here.

## Technical Notes

- NEVER commit a private signing key. The placeholder pubkey is a throwaway PUBLIC key (safe); the user MUST replace it with their own before the first real release, or clients won't verify their updates.
- `version` must stay consistent (tauri.conf.json + Cargo.toml); the updater compares it against `latest.json`.
- `gitignore` any `*.key` / signer output so a private key can't be committed by accident.
