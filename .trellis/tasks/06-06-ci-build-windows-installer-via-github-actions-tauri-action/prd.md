# CI: build Windows installer via GitHub Actions (tauri-action)

## Goal

Produce a usable Windows installer (`.msi`/NSIS `.exe`) so the user can test the
app on Windows. macOS cannot cross-compile a reliable Tauri Windows build (needs
WebView2 + native linking on Windows), so build on a `windows-latest` GitHub
Actions runner and publish the artifact for download. Also gives the project
ongoing CI (covers backlog #12).

## Constraints / facts
- Repo: `github.com:NoahCodeGG/scbox-app` (remote exists; nothing pushed yet).
  User approved pushing code to GitHub.
- Package manager: **pnpm** (no lockfile committed yet — `pnpm-lock.yaml` is
  gitignored? verify; tauri-action needs a reproducible install).
- Frontend build: `pnpm build` (`tsc && vite build`); Tauri config
  `beforeBuildCommand` is currently `pnpm build`, `frontendDist` `../dist`.
- Rust deps include `tts` (WinRT on Windows) and `reqwest` — must compile on the
  Windows runner.
- App identifier `com.scbox-app.app`; bundle targets `"all"` in tauri.conf.json.

## Decisions (locked, autonomous)
| Topic | Decision |
|-------|----------|
| Trigger | `workflow_dispatch` (manual button) + push to `main`. NOT tag-gated, so the user can build on demand without cutting a release. |
| Output | Upload the Windows bundle(s) as a **workflow artifact** (download from the Actions run). Do NOT auto-create a public GitHub Release yet (user hasn't decided on public distribution). |
| Runner | `windows-latest`. Single-platform job for now (macOS/Linux CI can be added later; this task is Windows-focused). |
| Action | Official `tauri-apps/tauri-action`; set up pnpm + Node + Rust toolchain + Rust/pnpm cache. |
| Signing | None (unsigned build; the user expects a SmartScreen warning on first run — note it in the task). |
| Tests in CI | Run `pnpm test` + `cargo test` as a quick gate before the bundle step (cheap, catches regressions). Optional: keep it minimal if it slows the build too much. |

## Requirements
* R1: `.github/workflows/build-windows.yml` builds on `windows-latest` via
  `tauri-action`, using pnpm install, and uploads the `.msi` and/or `.exe`
  bundle as an artifact.
* R2: Triggers: `workflow_dispatch` and push to `main`.
* R3: Caching for Rust (`Swatinem/rust-cache` or tauri-action's built-in) and
  pnpm store so repeat builds are reasonable.
* R4: A committed `pnpm-lock.yaml` (if currently gitignored, un-ignore + commit
  it) so CI installs are reproducible. Verify `.gitignore` doesn't exclude it.
* R5: The workflow must actually produce a downloadable Windows installer when
  run (the user will trigger it and report back).

## Acceptance Criteria
* [ ] Workflow file is valid YAML and uses `tauri-apps/tauri-action`.
* [ ] Installs deps with pnpm (matching the project) and builds the frontend.
* [ ] Uploads the Windows bundle as a workflow artifact.
* [ ] `pnpm-lock.yaml` is committed (reproducible installs).
* [ ] On a real run (user-triggered), an installable `.msi`/`.exe` is downloadable.

## Out of Scope
* Code signing / notarization.
* Auto-publishing a public GitHub Release.
* macOS/Linux CI matrix (later).
* Auto-update / updater endpoint.

## Definition of Done
* Workflow committed; lockfile committed; instructions for the user to trigger
  the build and where to download the artifact are recorded (in the task or a
  short note). The Windows audio scenarios from task #2 can finally be tested
  with this installer.

## Technical Notes
* This is the main session's call to actually `git push` (user-approved). Plan:
  commit the workflow + lockfile, push `main` to origin, then the user triggers
  `workflow_dispatch` (or the push itself triggers it).
* tauri-action reference: https://github.com/tauri-apps/tauri-action — it can
  build without creating a release when `tagName`/`releaseId` are omitted; pair
  with `actions/upload-artifact` to expose the bundle.
* Note the unsigned-build SmartScreen warning for the user.
* The runner needs Node + pnpm (`pnpm/action-setup`) + Rust (`dtolnay/rust-toolchain`)
  before tauri-action, or rely on tauri-action's setup where available.
