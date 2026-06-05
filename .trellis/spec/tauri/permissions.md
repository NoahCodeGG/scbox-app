# Permissions & Capabilities

> Tauri 2's ACL: what the frontend (webview) is allowed to call.

---

## How It Works

Tauri 2 denies IPC by default. A **capability** file under
`src-tauri/capabilities/` grants a set of **permissions** to named windows.
`scbox-app` ships one (`capabilities/default.json`):

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default"
  ]
}
```

- `core:default` — the baseline set of core Tauri commands.
- `opener:default` — granted because `tauri-plugin-opener` is registered in
  `lib.rs`. Each plugin contributes its own `*:default` (and finer-grained)
  permissions.

---

## Rules

- **Every plugin you add in `lib.rs` needs a matching permission** in a
  capability, or its commands reject at runtime. Add the plugin's
  `<plugin>:default` (or specific permissions) to `default.json`.
- Grant the **narrowest** permission that works. Prefer a specific permission
  (e.g. `opener:allow-open-url`) over a broad `*:default` once you know exactly
  what the app uses.
- The `$schema` reference points at generated schemas under `src-tauri/gen/`
  (gitignored, produced by the build) — autocompletion/validation depends on
  having built once.
- Scope to the windows that need it via the `windows` array; don't widen it
  beyond `["main"]` without a reason.

---

## Adding a Capability for a New Plugin

1. Add the plugin to `Cargo.toml` and `.plugin(...)` in `lib.rs`.
2. Add its permission(s) to `capabilities/default.json` (or a new, dedicated
   capability file if the grant should be window-scoped differently).
3. Rebuild so generated schemas/permissions refresh.
4. Verify from the frontend that the command now resolves instead of rejecting
   with a permission error.

> Security: capabilities are the trust boundary between untrusted webview code
> and native APIs. Treat widening them like widening a firewall rule — justify
> each new permission.
