# Window lifecycle: main close = hide + reopenable; coherent quit

## Goal

After closing the main window, the overlay keeps running and the overlay's
edit/settings buttons (and the dock on macOS) must bring the main window back.
Today closing main destroys it so `open_main` fails. Also fix the conflicting
overlay-close handling (lib.rs hides it while `useWindowControls` calls
`exit_app`) and provide a clear way to quit.

## What I already know

- `lib.rs`: an `on_window_event` for the `overlay` window does `prevent_close()` + `hide()` (overlay close = hide). There is NO handler for the `main` window → closing main DESTROYS it (Tauri default) → `get_webview_window("main")` returns None → `open_main` errors → the overlay's edit/settings buttons (which `invoke("open_main")`) silently do nothing.
- `open_main(app)` = get_webview_window("main") → show + set_focus.
- `useWindowControls.ts` (runs in the OVERLAY window): `onCloseRequested` → `preventDefault()` → save window position (outerPosition/monitors) → `invoke("exit_app")`. This is leftover from when the overlay WAS the main window. Now it (a) quits the app when the overlay is closed, and (b) conflicts with lib.rs's overlay hide handler.
- `exit_app` command exists (process::exit).
- Main window is `visible:true`, normal; overlay is `visible:false`, alwaysOnTop, launched via `open_overlay`/hidden via `hide_overlay`/close=hide.

## Decisions (reversible defaults — AskUserQuestion was unavailable)

- **(D1) Main window close = hide** (prevent_close + hide), mirroring the overlay, so it's never destroyed and `open_main` re-shows it. The app does NOT quit when main closes.
- **(D2) Overlay window close = hide** (keep lib.rs handler) AND remove the `exit_app` call from `useWindowControls` — closing the overlay hides it (reopen from the dashboard), it does NOT quit the app. Keep saving the overlay window position on close (then it hides via the Rust handler).
- **(D3) Quit path** = a "退出" button in the MAIN window sidebar footer (calls `exit_app`), plus native Cmd+Q on macOS. macOS dock-click reopen should re-show the main window.

## Requirements

- Closing the main window hides it (app keeps running); the overlay's 编辑/设置 buttons (`open_main`) reliably re-show + focus the main window afterwards.
- Closing the overlay hides it (reopen via dashboard 启动悬浮窗); it does NOT quit the app; overlay position is still persisted on close.
- A visible "退出" affordance in the main window quits the app (`exit_app`); Cmd+Q quits on macOS.
- macOS: clicking the dock icon when the main window is hidden re-shows it.
- No conflicting double close-handlers causing fl... the overlay close path is single + coherent.

## Acceptance Criteria

- [ ] Close main → main hides, app still running (overlay alive). Click 编辑 or 设置 on the overlay → main reappears and focuses.
- [ ] Close overlay → overlay hides (not quit); relaunch from dashboard works; position remembered.
- [ ] The 退出 button quits the app; Cmd+Q quits on macOS.
- [ ] macOS dock click re-shows a hidden main window.
- [ ] No window-destroyed state that breaks open_main/open_overlay.
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Technical Approach

- `lib.rs`: add an `on_window_event` for the `main` window: on `CloseRequested` → `api.prevent_close()` + `window.hide()` (mirror the overlay handler). `open_main` stays show+set_focus (optionally `unminimize`).
- `lib.rs` (macOS reopen): handle the app `RunEvent::Reopen` (or `tauri::RunEvent`) to show+focus the `main` window when the dock icon is clicked. Verify the exact Tauri 2 API; if cleanly doable, add it; otherwise note it as a follow-up (don't block).
- `useWindowControls.ts`: in `onCloseRequested`, after saving position, REMOVE `invoke("exit_app")`. The overlay's lib.rs handler will hide it. (Keep `preventDefault` + position save. Ensure no exit.) Update the hook's test (`useWindowControls.test.ts`) which asserts `exit_app` is invoked on close — change it to assert position-save + NO exit (and that it doesn't quit).
- `MainWindow.tsx`: add a "退出" button in the sidebar footer (near the version) → `invoke("exit_app")`. Typed, no any.
- Keep `exit_app` command (now used by the Quit button, not overlay close).

## Out of Scope

- System tray (none today); onboarding; Windows real-machine verification.
- Changing other IPC/type contracts.

## Technical Notes

- `useWindowControls` runs in the overlay; its close handler must not quit the app anymore. Its existing test asserts `exit_app` — update it.
- Avoid two handlers fighting over the overlay close: lib.rs hides; JS only saves position + preventDefault (no exit, no separate hide needed, but harmless if it also hides). Keep it single-purpose.
- No new persisted settings.
