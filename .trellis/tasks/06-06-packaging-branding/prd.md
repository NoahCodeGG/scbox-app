# Packaging, branding, and auto-update

## Goal

Move the app from create-tauri-app scaffold defaults toward a shippable,
branded build: real product name/metadata, an in-app version/about, a proper
icon, and (optionally) an auto-update channel — scoped to what is doable and
verifiable on macOS now, with Windows-only/asset/secret-blocked parts deferred.

## What I already know

- `src-tauri/tauri.conf.json`: `productName: "scbox-app"`, `version: "0.1.0"`, `identifier: "com.scbox-app.app"`. Icons array points at `icons/*` which are the **default Tauri scaffold icons** (generated 01:08 with the scaffold).
- `src-tauri/Cargo.toml`: `description = "A Tauri App"`, `authors = ["you"]` — placeholder metadata.
- CI (`.github/workflows/build-windows.yml`): builds an UNSIGNED Windows .msi/.exe as an artifact via tauri-action; **no GitHub Release**; runs frontend+rust tests first. SmartScreen warns (documented).
- No in-app version/about display anywhere. Overlay window title is `scbox-app`; editor window title `建造顺序编辑器`.
- App is React+Tauri; version could be surfaced via `@tauri-apps/api/app` `getVersion()` or injected.

## Blockers / external dependencies

- **Custom icon** requires a source logo image (~1024px PNG) → `tauri icon`. No artwork exists; cannot be invented. NEEDS a user-provided asset, else keep defaults.
- **Auto-update** requires a Tauri updater **signing keypair** (`tauri signer generate`): public key in config, private key + password as **GitHub secrets the user must add**, plus CI creating GitHub Releases with a `latest.json` endpoint. Not end-to-end verifiable until a release is published.
- **Windows code signing** (removes SmartScreen warning) needs a **paid code-signing certificate**. Out of practical scope — document only.

## Decisions

NOTE: the AskUserQuestion tool timed out repeatedly; these are reversible defaults chosen to keep momentum — the user can redirect any of them.

- **(Q1) Scope = S1 + S2** (branding metadata + in-app version/about) — the macOS-verifiable, no-external-dependency subset. Deferred: **S3 icon** (needs a user-provided ~1024px source logo), **S4 auto-update** (its own later task — needs updater keypair + GitHub secrets + published Releases), **S5 Windows code signing** (needs a paid cert; document-only).
- **(Q2) Display name = "SCBox Assistant"** (reversible placeholder). Applied to `productName` and the in-app about/version line. Window titles: overlay → "SCBox Assistant", editor stays "建造顺序编辑器".
- **(Q3) Icon = keep scaffold defaults** this task.
- **Identifier stays `com.scbox-app.app`** — it determines the OS app-data dir (where user builds/settings live); changing it would orphan existing data. Do NOT change it.

## Requirements

- `tauri.conf.json`: `productName` → "SCBox Assistant". Leave `identifier` and `version` (0.1.0) as-is. Window title for the `main` window → "SCBox Assistant" (editor title unchanged).
- `Cargo.toml`: real `description` (e.g. "SC2 build-order voice assistant (6119 auto-sync)") and `authors` (use the repo owner; if unknown, a neutral value — NOT "you").
- In-app version/about: surface the app version (via `@tauri-apps/api/app` `getVersion()`) unobtrusively — a small footer line in `SettingsPanel` like "SCBox Assistant v0.1.0". Handle the async read gracefully (no crash if it rejects).
- Document deferred S4/S5 (auto-update, signing) so the next task has context.

## Acceptance Criteria

- [ ] Built/dev app shows "SCBox Assistant" as the product/window name (overlay title), not "scbox-app".
- [ ] `Cargo.toml` has a real description + authors (no "A Tauri App"/"you").
- [ ] SettingsPanel shows the current app version read at runtime; if the read fails the panel still renders.
- [ ] `identifier` unchanged (app-data dir preserved); existing builds/settings still load.
- [ ] tsc / vitest / cargo green; `pnpm tauri dev` launches and the name/version are visible.

## Technical Approach

- Edit `src-tauri/tauri.conf.json` (`productName`, main window `title`) and `src-tauri/Cargo.toml` (`description`, `authors`). Keep `identifier`/`version`.
- Add a tiny version read: `getVersion()` from `@tauri-apps/api/app` in a small hook or inline in `SettingsPanel` (useState + useEffect, swallow errors to a null version → render nothing or a fallback). Keep it typed, no `any`.
- Add a short "Deferred: auto-update & code signing" note (in the CI workflow comment or a brief doc) pointing at S4/S5 prerequisites (keypair, GitHub secrets, Releases; paid cert).

## Implementation Plan (small PRs / phases)

- **PR1**: branding metadata (tauri.conf.json + Cargo.toml) + window title.
- **PR2**: in-app version/about in SettingsPanel (getVersion) + tests for the version hook if extracted; macOS run-through.

## Out of Scope (explicit)

- S3 custom icon (needs source asset), S4 auto-update (own task), S5 paid code signing.
- Changing `identifier` or app-data location.
- Windows real-machine verification (deferred).

## Technical Notes

- `version` stays consistent across `tauri.conf.json` and `Cargo.toml` (both 0.1.0); if surfaced from `package.json` later, keep them aligned.
- `getVersion()` returns the Tauri-config version at runtime — no need to hardcode it in the UI.
