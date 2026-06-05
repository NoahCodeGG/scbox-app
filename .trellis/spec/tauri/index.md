# Tauri (Rust Backend) Guidelines

> Conventions for the Rust/Tauri layer of `scbox-app`, under `src-tauri/`.

---

## Stack

- **Tauri 2** (`tauri = "2"`), edition 2021.
- Crate `scbox_app_lib` exposes `run()`; `src/main.rs` calls it, `src/lib.rs`
  builds and runs the app.
- `serde` + `serde_json` (derive feature) for IPC (de)serialization.
- `tauri-plugin-opener` registered in the builder.

```
src-tauri/
├── src/
│   ├── main.rs        # thin binary — calls scbox_app_lib::run()
│   └── lib.rs         # Builder setup + #[tauri::command] handlers
├── capabilities/
│   └── default.json   # permission ACL for the main window
├── tauri.conf.json    # app config (window, bundle, dev URL)
├── Cargo.toml
└── build.rs
```

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| [IPC Commands](./ipc-commands.md) | Defining `#[tauri::command]` handlers and the `invoke` contract |
| [Permissions & Capabilities](./permissions.md) | The capabilities ACL and adding plugins |

Related: [Frontend spec layer](../frontend/index.md) ·
[Cross-Layer Thinking Guide](../guides/cross-layer-thinking-guide.md).

---

## Working Rules

- The frontend reaches Rust **only** through `invoke` (commands) and `emit` /
  `listen` (events). There is no other shared state across the boundary.
- Keep `lib.rs` thin: register handlers and plugins there, but move non-trivial
  command bodies into their own modules as they grow (200–400 lines per file).
- Every new command must be added to `generate_handler!` **and** granted by a
  capability before the frontend can call it.

**Language**: All documentation is written in **English**.
