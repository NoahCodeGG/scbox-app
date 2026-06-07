# Customizable click-through shortcut

## Goal

Make the 穿透模式 (click-through) global shortcut configurable in Settings
instead of the hardcoded `CmdOrCtrl+Shift+S`.

## What I already know

- `src-tauri/src/lib.rs` setup registers `app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+S", |...| emit("ui://toggle-clickthrough"))` (hardcoded, ~line 260). The overlay listens for `ui://toggle-clickthrough` (in `useWindowControls`) and turns click-through OFF.
- `tauri-plugin-global-shortcut` is registered; `global-shortcut:default` capability granted to both windows.
- `save_settings` command (lib.rs) persists settings + updates the shared SC2 port; it has the `app: AppHandle`.
- Settings is the cross-layer contract: `settings.rs` (Rust serde) ↔ `useSettings.ts` (`Settings`) ↔ `src/lib/settings.ts` normalize. Settings page = `SettingsPanel.tsx`.

## Decision

- Add a persisted `clickThroughShortcut: string` to `Settings` (Tauri accelerator format, default `"CmdOrCtrl+Shift+S"`).
- Register the shortcut FROM the setting at startup; RE-register when it changes (on `save_settings`): `unregister_all()` then `on_shortcut(accel, emit handler)`. Invalid accelerators are caught/logged (don't break save).
- Settings UI: a key-RECORDER control — click "录制", press a modifier+key combo, it captures and stores the Tauri accelerator string (require ≥1 modifier + a main key). Show the current combo; a reset-to-default option.

## Requirements

- The click-through shortcut is read from `settings.clickThroughShortcut`, registered at startup, and re-registered live when changed (no restart).
- Settings page lets the user record a new shortcut (modifier(s)+key); shows the current one.
- Default stays `CmdOrCtrl+Shift+S`; existing behavior unchanged for users who don't customize.
- Invalid/unregisterable accelerator doesn't crash or break save (graceful).

## Acceptance Criteria

- [ ] Changing the shortcut in Settings re-registers it immediately; the new combo toggles click-through off; the old one no longer works.
- [ ] On launch, the configured shortcut is active.
- [ ] Recorder captures a valid modifier+key combo and shows it; reset restores the default.
- [ ] tsc / vitest / coverage / cargo green; build ok.

## Technical Approach

- **Cross-layer `clickThroughShortcut`**: `settings.rs` add `#[serde(default = "default_click_through_shortcut")] pub click_through_shortcut: String` (default `"CmdOrCtrl+Shift+S"`) + in `Default`; update the field-set tests. `useSettings.ts` add `clickThroughShortcut: string` + `DEFAULT_SETTINGS`. `src/lib/settings.ts` normalize (non-empty string → keep, else default); update `lib/settings.test.ts` + `useSettings.test.ts`.
- **Rust registration**: extract a helper `fn register_clickthrough_shortcut(app: &AppHandle, accel: &str)` that does `global_shortcut().unregister_all().ok(); global_shortcut().on_shortcut(accel, move |_,_,_| emit("ui://toggle-clickthrough"))` with error logging. Call it in setup with the loaded setting (fallback default) instead of the hardcoded string. In `save_settings`, after persisting, call it with `settings.click_through_shortcut` so a change takes effect live.
- **Recorder UI** (`SettingsPanel.tsx`, 悬浮窗 group): a small component/inline control with a "录制" button that, while recording, captures the next `keydown` (preventDefault), builds a Tauri accelerator string from the event modifiers + key (ctrl/meta → `CmdOrCtrl`, shift → `Shift`, alt → `Alt`; main key = the uppercased letter or a mapped key/code), requires ≥1 modifier + a non-modifier key, and sets `draft.clickThroughShortcut`. Show the current combo (formatted) + a "重置" to default. Pure accelerator-building logic should be a small typed helper (unit-testable). Persisted on Save with the rest.

## Out of Scope

- Customizing other shortcuts; per-OS variants beyond CmdOrCtrl; Windows verification.

## Technical Notes

- Additive cross-layer change: `Settings.clickThroughShortcut` mirror in settings.rs ↔ useSettings ↔ normalize. No other contract changes (the event name `ui://toggle-clickthrough` stays).
- Accelerator format is the tauri-plugin-global-shortcut/`CmdOrCtrl+Shift+S` style. Keep the default exactly `"CmdOrCtrl+Shift+S"`.
- `on_shortcut` registers a handler; call `unregister_all` before re-registering to avoid duplicates.
- If a put a pure `buildAccelerator(e)` helper in `src/lib/`, add a small test (it's a lib, not a hook). Keep types strict, no `any`.
