mod builds;
mod sc2;
mod settings;
mod tts;

use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::GlobalShortcutExt;

use builds::LoadResult;
use settings::Settings;

const POLL_INTERVAL: Duration = Duration::from_millis(1000);

/// Subdirectory under the app-data dir holding user-editable build orders.
const BUILDS_SUBDIR: &str = "builds";

/// Tauri-managed shared SC2 Client API port. A `u16` is `Send + Sync`, so it is
/// safe to `manage` (unlike `tts::Tts`). The poll loop reads it each tick and
/// `save_settings` writes it, so a port change in the UI takes effect on the
/// next tick without a restart.
type SharedPort = Arc<Mutex<u16>>;

/// Load every build order from the app-data `builds/` dir, seeding the bundled
/// default on first run. Returns the valid builds plus a per-file error list so
/// the frontend can surface partial failures without crashing.
#[tauri::command]
fn load_build_orders(app: tauri::AppHandle) -> Result<LoadResult, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("cannot resolve app data dir: {e}"))?
        .join(BUILDS_SUBDIR);

    builds::seed_if_empty(&dir)
        .map_err(|e| format!("cannot seed builds dir: {e}"))?;

    Ok(builds::load_from_dir(&dir))
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_build_orders,
            load_settings,
            save_settings,
            tts::speak_tts,
            tts::stop_tts,
            tts::list_voices
        ])
        .setup(|app| {
            // Seed the shared SC2 port from persisted settings (default 6119 if
            // the file is missing or unreadable), then manage it so both the
            // poll loop and `save_settings` share one source of truth.
            let seed_port = app
                .path()
                .app_data_dir()
                .ok()
                .and_then(|dir| settings::load_from_dir(&dir).ok())
                .map(|s| s.client_api_port)
                .unwrap_or(settings::DEFAULT_CLIENT_API_PORT);
            let shared_port: SharedPort = Arc::new(Mutex::new(seed_port));
            app.manage(shared_port.clone());

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
