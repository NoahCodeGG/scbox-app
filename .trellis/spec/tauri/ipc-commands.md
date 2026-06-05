# IPC Commands

> Defining Rust commands and the `invoke` contract with the frontend.

---

## The Pattern (from `src/lib.rs`)

A command is a Rust function annotated with `#[tauri::command]`, registered in
`generate_handler!`:

```rust
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

The frontend calls it (from `src/App.tsx:12`):

```tsx
import { invoke } from "@tauri-apps/api/core";

const msg = await invoke<string>("greet", { name });
```

---

## The Contract (must stay in sync)

This is the project's most important cross-layer boundary. A mismatch compiles
on both sides but fails at runtime.

| Concern | Rust side | Frontend side |
|---------|-----------|---------------|
| Command name | function name `greet` | first arg to `invoke`: `"greet"` |
| Arguments | parameter names `name: &str` | object keys `{ name }` |
| Argument case | snake_case params | Tauri maps to **camelCase** keys in JS |
| Return type | `-> String` | `invoke<string>(...)` type argument |
| Registration | listed in `generate_handler!` | n/a — unregistered name rejects at runtime |

When you add or rename a command, update **all five** rows. Argument names use
snake_case in Rust; pass them as camelCase from JavaScript (Tauri converts).

---

## Adding a New Command

1. Write the `#[tauri::command]` function. Use `serde::Deserialize` structs for
   complex inputs and `serde::Serialize` structs for complex outputs (the
   `derive` feature is already enabled in `Cargo.toml`).
2. Add it to `tauri::generate_handler![...]` in `run()`.
3. Ensure a capability grants it (see [permissions.md](./permissions.md)).
4. On the frontend, wrap it in a typed hook
   (see [../frontend/hook-guidelines.md](../frontend/hook-guidelines.md)) with a
   shared TS type mirroring the serialized shape.

---

## Errors

Return `Result<T, E>` where `E: Serialize` (commonly `Result<T, String>`) so
failures reject the JS promise instead of panicking. The frontend must catch
the rejection — never `unwrap()`/`expect()` on recoverable input in a command
body. `expect()` is acceptable only for unrecoverable startup wiring, as in
`run()`.

```rust
#[tauri::command]
fn read_thing(id: u32) -> Result<Thing, String> {
    do_read(id).map_err(|e| e.to_string())
}
```

---

## Async & State

- Long-running work should be `async fn` commands so the UI thread is not
  blocked.
- Share backend state with `.manage(state)` on the builder and a
  `tauri::State<'_, T>` parameter rather than global mutable statics.
