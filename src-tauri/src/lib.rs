mod builds;
mod sc2;
mod tts;

use std::time::Duration;
use tauri::{Emitter, Manager};

use builds::LoadResult;

const POLL_INTERVAL: Duration = Duration::from_millis(1000);

/// Subdirectory under the app-data dir holding user-editable build orders.
const BUILDS_SUBDIR: &str = "builds";

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_build_orders,
            tts::speak_tts,
            tts::stop_tts,
            tts::list_voices
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let client = reqwest::Client::new();
                loop {
                    let snapshot = sc2::fetch_snapshot(&client).await;
                    let _ = handle.emit(sc2::GAME_EVENT, snapshot);
                    tokio::time::sleep(POLL_INTERVAL).await;
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
