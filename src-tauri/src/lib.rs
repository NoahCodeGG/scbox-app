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

const POLL_INTERVAL: Duration = Duration::from_millis(1000);

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

/// Load every build order from the app-data `builds/` dir, seeding the bundled
/// default on first run. Returns the valid builds plus a per-file error list so
/// the frontend can surface partial failures without crashing.
#[tauri::command]
fn load_build_orders(app: tauri::AppHandle) -> Result<LoadResult, String> {
    let dir = builds_dir(&app)?;

    builds::seed_if_empty(&dir)
        .map_err(|e| format!("cannot seed builds dir: {e}"))?;

    Ok(builds::load_from_dir(&dir))
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
    Ok(())
}

/// Exit the application immediately. Used after saving window position on close.
#[tauri::command]
fn exit_app() {
    std::process::exit(0);
}

/// Show and focus the build-order editor window (declared hidden in
/// `tauri.conf.json`). Opening it lazily keeps the editor out of the way until
/// the user asks for it.
#[tauri::command]
fn open_editor(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("editor")
        .ok_or_else(|| "editor window not found".to_string())?;
    window.show().map_err(|e| format!("cannot show editor: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("cannot focus editor: {e}"))?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
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
            open_editor
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

            // Keep the editor window reusable: closing it should hide it (so a
            // later `open_editor` can show it again) rather than destroy it,
            // which would make `get_webview_window("editor")` return None.
            if let Some(editor) = app.get_webview_window("editor") {
                let editor_for_event = editor.clone();
                editor.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = editor_for_event.hide();
                    }
                });
            }

            // Restore window position from saved settings (if available) to avoid
            // visible jump from default position on startup. Window starts hidden
            // (tauri.conf.json visible: false), so we show it after positioning.
            // Target the main overlay explicitly by label — the editor window
            // also exists (hidden) so a generic "first window" lookup would be
            // nondeterministic.
            let window_opt = app.get_webview_window("main");

            if let Some(s) = settings {
                if let (Some(x), Some(y)) = (s.window_x, s.window_y) {
                    if let Some(window) = &window_opt {
                        let logical_pos = tauri::LogicalPosition::new(x, y);
                        if let Err(e) = window.set_position(logical_pos) {
                            eprintln!("Failed to restore window position: {e}");
                        }
                    }
                }
            }

            // Show the window after positioning (or immediately if no saved position).
            // Use a small delay to allow the window manager to process the position
            // change before showing, reducing visible flicker.
            let window_for_show = window_opt.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(50));
                if let Some(window) = window_for_show {
                    if let Err(e) = window.show() {
                        eprintln!("Failed to show window: {e}");
                    }
                }
            });

            // Register global shortcut to disable click-through from outside the window.
            // The shortcut emits an event that the frontend listens for.
            let handle = app.handle().clone();
            if let Err(e) = app.global_shortcut().on_shortcut("CmdOrCtrl+Shift+S", move |_app, _shortcut, _event| {
                let _ = handle.emit("ui://toggle-clickthrough", ());
            }) {
                eprintln!("Failed to register global shortcut: {e}");
            }

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let client = reqwest::Client::new();
                loop {
                    // Lock, copy the port, drop the guard BEFORE awaiting — never
                    // hold a std::sync::Mutex guard across `.await`.
                    let port = match shared_port.lock() {
                        Ok(guard) => *guard,
                        Err(poisoned) => *poisoned.into_inner(),
                    };
                    let snapshot = sc2::fetch_snapshot(&client, port).await;
                    let _ = handle.emit(sc2::GAME_EVENT, snapshot);
                    tokio::time::sleep(POLL_INTERVAL).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
