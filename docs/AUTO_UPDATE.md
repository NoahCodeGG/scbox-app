# Auto-Update Setup & Release Handoff

SCBox Assistant uses Tauri 2's updater plugin. The app checks
`https://github.com/NoahCodeGG/scbox-app/releases/latest/download/latest.json`
on launch (and via the **检查更新** button in Settings) and prompts before
downloading + installing a newer **signed** release.

Update artifacts must be signed with a keypair that only YOU hold. The repo
currently ships a **throwaway placeholder** public key in
`src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) so config is schema-valid
and the dev app boots cleanly. Clients will NOT verify real updates until you
replace it with your own public key. The private key never goes through the repo
or any assistant.

`*.key` / `*.key.pub` are gitignored so a private key cannot be committed.

---

## One-time setup (you do this before the first real release)

### 1. Generate your signing keypair

```sh
pnpm tauri signer generate -w ~/.tauri/scbox-updater.key
```

Set a password when prompted and store it safely. This writes:

- `~/.tauri/scbox-updater.key` — PRIVATE key (keep secret, never commit)
- `~/.tauri/scbox-updater.key.pub` — PUBLIC key

### 2. Replace the placeholder public key

Copy the contents of `~/.tauri/scbox-updater.key.pub` and paste it as the value
of `plugins.updater.pubkey` in `src-tauri/tauri.conf.json`, replacing the
committed placeholder. Commit this change.

> If you skip this step, clients reject every update because they verify against
> the throwaway key whose private half was destroyed.

### 3. Add the GitHub repo secrets

In the GitHub repo: **Settings → Secrets and variables → Actions → New
repository secret**. Add both:

- `TAURI_SIGNING_PRIVATE_KEY` — the full contents of
  `~/.tauri/scbox-updater.key`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — the password you set in step 1

---

## Cutting a release (each version)

### 4. Bump the version in BOTH files (must match)

- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`

The updater compares the running app's version against `latest.json`, so these
must stay identical (currently `0.1.0`).

### 5. Tag and push

```sh
git tag v0.2.0
git push origin v0.2.0
```

Pushing a `v*` tag triggers `.github/workflows/release.yml` (matrix:
windows-latest + macos-latest). It builds, signs the updater artifacts,
generates `latest.json`, and uploads everything to a **draft** GitHub Release.

### 6. Publish the draft Release

Open the draft Release on GitHub, review the artifacts, and click **Publish**.
Once published, `releases/latest/download/latest.json` resolves and clients pick
up the update on their next check.

---

## Notes

- The existing `.github/workflows/build-windows.yml` is unchanged — it still
  produces UNSIGNED test artifacts on pushes to `main`, with no Release.
- macOS `.app` updater signing (the Tauri keypair above) is SEPARATE from Apple
  notarization / Gatekeeper. Without an Apple Developer cert, macOS users still
  see a Gatekeeper warning on first launch; that is out of scope here.
- Windows code signing (SmartScreen) is also separate and needs a paid
  certificate — out of scope.
- Offline machines or a mismatched/placeholder pubkey make the update check fail
  gracefully: the error is shown in Settings, nothing crashes.
