# Multi-Window & Cross-Window Events

> How `scbox-app` runs a second window (the build-order editor) alongside the
> always-on-top overlay, and how the two windows stay in sync.

---

## Scope / Trigger

Applies whenever you add a window beyond the main overlay, or coordinate state
between windows. Introduced by the in-app build-order editor, which runs in its
own `editor` window and tells the overlay to reload after edits.

---

## The Pattern

### 1. Declare the window (hidden) in `tauri.conf.json`

Every window gets an explicit `label`. The main overlay MUST be labelled
`"main"` (capabilities and `setup()` reference it by that name). Extra windows
start `"visible": false` and are shown on demand.

```jsonc
"windows": [
  { "label": "main",   "title": "scbox-app", "width": 320, "height": 200,
    "alwaysOnTop": true, "visible": false },
  { "label": "editor", "title": "建造顺序编辑器", "width": 900, "height": 700,
    "minWidth": 600, "minHeight": 400, "resizable": true, "visible": false }
]
```

### 2. One capability file per window

Capabilities are window-scoped via the `windows` array. A new window needs its
own file under `capabilities/` (don't widen `default.json`'s `["main"]`).

```jsonc
// capabilities/editor.json
{ "identifier": "editor", "windows": ["editor"], "permissions": ["core:default"] }
```

`core:default` already covers `invoke` of your own `#[tauri::command]`s and
`core:event` (emit/listen). Window ops called from **Rust** (`window.show()`,
`set_focus()`, `hide()`) bypass the ACL entirely, so do NOT add
`core:window:allow-*` permissions for them — they would be dead grants.

### 3. Route the React entry by window label

Both windows load the same bundle; `main.tsx` picks the view from the label
(synchronous, no `await`):

```tsx
import { getCurrentWindow } from "@tauri-apps/api/window";
const isEditor = getCurrentWindow().label === "editor";
root.render(isEditor ? <BuildEditor /> : <App />);
```

### 4. Open command shows + focuses the existing window

```rust
#[tauri::command]
fn open_editor(app: tauri::AppHandle) -> Result<(), String> {
    let w = app.get_webview_window("editor")
        .ok_or_else(|| "editor window not found".to_string())?;
    w.show().map_err(|e| format!("cannot show editor: {e}"))?;
    w.set_focus().map_err(|e| format!("cannot focus editor: {e}"))?;
    Ok(())
}
```

### 5. Close = hide, not destroy (CRITICAL)

A declared window is created once at startup. If the user closes it, Tauri
**destroys** it by default, after which `get_webview_window("editor")` returns
`None` and `open_editor` fails forever. Intercept the close and hide instead:

```rust
if let Some(editor) = app.get_webview_window("editor") {
    let w = editor.clone();
    editor.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            api.prevent_close();
            let _ = w.hide();
        }
    });
}
```

### 6. Cross-window reload via a shared event name

Windows don't share React state. After the editor writes, it `emit`s an app
event; the overlay `listen`s and reloads. Centralize the event name so the two
ends can't drift:

```ts
// src/lib/events.ts
export const BUILDS_CHANGED_EVENT = "builds://changed";
```

```ts
// editor, after a successful save/delete
await emit(BUILDS_CHANGED_EVENT);
// overlay (App)
const unlisten = listen(BUILDS_CHANGED_EVENT, () => reload());
return () => { void unlisten.then((off) => off()); };
```

---

## Gotchas

> **`setup()` "first window" lookups are nondeterministic with 2+ windows.**
> `app.webview_windows().values().next()` returns an arbitrary window. Always
> target a specific window by label: `app.get_webview_window("main")`.

> **A redundant capability grant is not a security hole, but it is misleading.**
> Grant only what the *webview* calls. Rust-initiated window ops need nothing.

---

## Validation & Error Matrix

| Condition | Behavior |
|-----------|----------|
| `open_editor` when window exists (shown or hidden) | shows + focuses, `Ok(())` |
| `open_editor` after window destroyed (close not intercepted) | `Err("editor window not found")` — bug; prevent via close=hide |
| editor emits `BUILDS_CHANGED_EVENT`, overlay mounted | overlay reloads builds |
| editor emits before overlay listener mounted | event missed (acceptable: overlay also reloads on game-start + manual 重载) |

---

## Tests Required

- Multi-window wiring is integration/manual (no unit seam): verify on macOS that
  开 → 关 → 再开 editor works (exercises close=hide), and that a save in the
  editor updates the overlay without restart (exercises the event).
- Keep the cross-layer command/serde contract under the existing
  [IPC Commands](./ipc-commands.md) discipline.
