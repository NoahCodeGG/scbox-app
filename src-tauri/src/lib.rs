mod builds;
mod sc2;
mod settings;
mod tts;

use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use builds::{BuildOrder, LoadResult};
use settings::Settings;

/// Per-request timeout for the SC2 Client API poll. Kept below the base poll
/// cadence so a stalled socket cannot back up ticks.
const POLL_REQUEST_TIMEOUT: Duration = Duration::from_millis(800);

/// Subdirectory under the app-data dir holding user-editable build orders.
const BUILDS_SUBDIR: &str = "builds";

/// Tauri-managed shared SC2 Client API port. A `u16` is `Send + Sync`, so it is
/// safe to `manage` (unlike `tts::Tts`). The poll loop reads it each tick and
/// `save_settings` writes it, so a port change in the UI takes effect on the
/// next tick without a restart.
type SharedPort = Arc<Mutex<u16>>;

/// Resolve the app-data `builds/` dir for the given app handle.
fn builds_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?
        .join(BUILDS_SUBDIR))
}

/// (Re-)register the click-through toggle global shortcut from a Tauri
/// accelerator string. Clears any previously-registered shortcut first so a
/// live change (from `save_settings`) does not leave a stale binding. An invalid
/// or unregisterable accelerator is logged and ignored — it must not break save
/// or startup.
fn register_clickthrough_shortcut(app: &tauri::AppHandle, accel: &str) {
    let _ = app.global_shortcut().unregister_all();
    let handle = app.clone();
    if let Err(e) = app
        .global_shortcut()
        .on_shortcut(accel, move |_app, _shortcut, _event| {
            let _ = handle.emit("ui://toggle-clickthrough", ());
        })
    {
        eprintln!("Failed to register click-through shortcut '{accel}': {e}");
    }
}

/// Load build orders for the UI: read-only embedded defaults merged with the
/// user's editable builds from the app-data `builds/` dir. Pristine seed files
/// from the old seed-on-first-run model are cleaned up on load. Returns the
/// valid builds plus a per-file error list so the frontend can surface partial
/// failures without crashing.
#[tauri::command]
fn load_build_orders(app: tauri::AppHandle) -> Result<LoadResult, String> {
    let dir = builds_dir(&app)?;
    Ok(builds::load_builds(&dir))
}

/// Save a single build order to `builds/<filename>` in the app-data dir. The
/// filename is validated against path traversal before use. Overwrites an
/// existing file of the same name (that is how an edit persists).
#[tauri::command]
fn save_build_order(
    app: tauri::AppHandle,
    filename: String,
    build: BuildOrder,
) -> Result<(), String> {
    let dir = builds_dir(&app)?;
    builds::save_to_dir(&dir, &filename, &build)
}

/// Delete `builds/<filename>` from the app-data dir. The filename is validated
/// against path traversal first; a missing file is treated as success.
#[tauri::command]
fn delete_build_order(
    app: tauri::AppHandle,
    filename: String,
) -> Result<(), String> {
    let dir = builds_dir(&app)?;
    builds::delete_from_dir(&dir, &filename)
}

/// Read the user settings JSON from the app-data dir. A missing file (first
/// run) yields the default settings rather than an error.
#[tauri::command]
fn load_settings(app: tauri::AppHandle) -> Result<Settings, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;

    settings::load_from_dir(&dir)
}

/// Persist the user settings JSON to the app-data dir, creating it if needed.
/// Also updates the shared SC2 port state so a port change takes effect on the
/// next poll tick without restarting the app.
#[tauri::command]
fn save_settings(
    app: tauri::AppHandle,
    port: tauri::State<'_, SharedPort>,
    settings: Settings,
) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?;

    settings::save_to_dir(&dir, &settings)?;

    // Update the shared port after a successful persist. Hold the std Mutex
    // guard only for the write — no `.await` while held.
    if let Ok(mut guard) = port.lock() {
        *guard = settings.client_api_port;
    }

    // Re-register the click-through shortcut so a changed accelerator takes
    // effect live without a restart. An invalid accelerator is logged & ignored.
    register_clickthrough_shortcut(&app, &settings.click_through_shortcut);
    Ok(())
}

/// Exit the application immediately. Used after saving window position on close.
#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

/// Show and focus the floating overlay window (declared hidden in
/// `tauri.conf.json`). Launched from the dashboard's "启动悬浮窗" button.
#[tauri::command]
fn open_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "overlay window not found".to_string())?;
    window.show().map_err(|e| format!("cannot show overlay: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("cannot focus overlay: {e}"))?;
    Ok(())
}

/// Hide the floating overlay window without destroying it, so a later
/// `open_overlay` can show it again.
#[tauri::command]
fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| "overlay window not found".to_string())?;
    window.hide().map_err(|e| format!("cannot hide overlay: {e}"))?;
    Ok(())
}

/// Show and focus the main dashboard window. Used by the overlay's gear icon to
/// surface the settings page in the main window.
#[tauri::command]
fn open_main(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    let _ = window.unminimize();
    window.show().map_err(|e| format!("cannot show main: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("cannot focus main: {e}"))?;
    Ok(())
}

/// Return the bundled app icon as a base64 PNG data URL. The bytes are embedded
/// at compile time from the same icon set the bundle uses (`icons/128x128.png`),
/// keeping the icon single-sourced. The frontend renders the URL directly in an
/// `<img>`; no extra capability is needed for a custom command.
#[tauri::command]
fn app_icon() -> String {
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD
        .encode(include_bytes!("../icons/128x128.png"));
    format!("data:image/png;base64,{encoded}")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            load_build_orders,
            save_build_order,
            delete_build_order,
            load_settings,
            save_settings,
            tts::speak_tts,
            tts::stop_tts,
            tts::list_voices,
            exit_app,
            open_overlay,
            hide_overlay,
            open_main,
            app_icon
        ])
        .setup(|app| {
            // Load settings early to seed shared state and restore window position.
            let settings = app
                .path()
                .app_data_dir()
                .ok()
                .and_then(|dir| settings::load_from_dir(&dir).ok());

            // Seed the shared SC2 port from persisted settings (default 6119 if
            // the file is missing or unreadable), then manage it so both the
            // poll loop and `save_settings` share one source of truth.
            let seed_port = settings
                .as_ref()
                .map(|s| s.client_api_port)
                .unwrap_or(settings::DEFAULT_CLIENT_API_PORT);
            let shared_port: SharedPort = Arc::new(Mutex::new(seed_port));
            app.manage(shared_port.clone());

            // Spawn the persistent TTS worker (one long-lived `!Send` `Tts` on
            // its own thread) and manage only the `Sender` so `speak_tts` /
            // `stop_tts` can queue cues without clobbering one another.
            let tts_tx = tts::spawn_tts_worker();
            app.manage(tts::TtsHandle(tts_tx));

            // Keep the overlay window reusable: closing it should hide it (so a
            // later `open_overlay` can show it again) rather than destroy it,
            // which would make `get_webview_window("overlay")` return None.
            if let Some(overlay) = app.get_webview_window("overlay") {
                let overlay_for_event = overlay.clone();
                overlay.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = overlay_for_event.hide();
                    }
                });
            }

            // Keep the MAIN window reusable: closing it should hide it (so a
            // later `open_main` — e.g. the overlay's 编辑/设置 buttons or a macOS
            // dock click — can re-show it) rather than destroy it, which would
            // make `get_webview_window("main")` return None. The app does not
            // quit when main closes; quit goes through the 退出 button / Cmd+Q.
            if let Some(main) = app.get_webview_window("main") {
                let main_for_event = main.clone();
                main.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = main_for_event.hide();
                    }
                });
            }

            // Restore the OVERLAY window position from saved settings (if
            // available) to avoid a visible jump from the default position. The
            // overlay starts hidden (tauri.conf.json visible: false) and is shown
            // on demand via `open_overlay`, so positioning it now is harmless. The
            // main window is a normal OS window — its position is not persisted.
            if let Some(ref s) = settings {
                if let (Some(x), Some(y)) = (s.window_x, s.window_y) {
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        let logical_pos = tauri::LogicalPosition::new(x, y);
                        if let Err(e) = overlay.set_position(logical_pos) {
                            eprintln!("Failed to restore overlay position: {e}");
                        }
                    }
                }
            }

            // Register the global shortcut to disable click-through from outside
            // the window, read from settings (default `CmdOrCtrl+Shift+S`). The
            // shortcut emits an event that the frontend listens for. A change in
            // Settings re-registers it live via `save_settings`.
            let accel = settings
                .as_ref()
                .map(|s| s.click_through_shortcut.clone())
                .unwrap_or_else(settings::default_click_through_shortcut);
            register_clickthrough_shortcut(&app.handle(), &accel);

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // A per-request timeout keeps a stalled socket from backing up
                // ticks. `expect` is acceptable for this startup wiring.
                let client = reqwest::Client::builder()
                    .timeout(POLL_REQUEST_TIMEOUT)
                    .build()
                    .expect("failed to build reqwest client");
                let mut interval_ms = sc2::BASE_POLL_INTERVAL_MS;
                loop {
                    // Lock, copy the port, drop the guard BEFORE awaiting — never
                    // hold a std::sync::Mutex guard across `.await`.
                    let port = match shared_port.lock() {
                        Ok(guard) => *guard,
                        Err(poisoned) => *poisoned.into_inner(),
                    };
                    let snapshot = sc2::fetch_snapshot(&client, port).await;
                    let connected = snapshot.connected;
                    let _ = handle.emit(sc2::GAME_EVENT, snapshot);
                    // Exponential backoff while disconnected; snaps to base on
                    // reconnect. Pure curve lives in `sc2::next_poll_interval_ms`.
                    interval_ms = sc2::next_poll_interval_ms(interval_ms, connected);
                    tokio::time::sleep(Duration::from_millis(interval_ms)).await;
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            // macOS: clicking the dock icon when all windows are hidden fires
            // `Reopen`. Re-show + focus the main window so a user who closed
            // (hid) it can always get it back. No-op on other platforms.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                if let Some(main) = app_handle.get_webview_window("main") {
                    let _ = main.unminimize();
                    let _ = main.show();
                    let _ = main.set_focus();
                }
            }
            // Silence unused warnings on non-macOS where the arm is compiled out.
            let _ = (app_handle, &event);
        });
}
