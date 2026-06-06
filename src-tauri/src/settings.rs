//! App settings persistence in the app-data directory.
//!
//! Settings live in a single user-editable JSON file (`settings.json`) under the
//! OS app-data dir, mirroring the build-order IO pattern in `builds.rs`. The
//! on-disk shape is the cross-layer contract mirrored by `Settings` in
//! `src/hooks/useSettings.ts` — keep the (camelCase) field names in sync.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// User-editable application settings.
///
/// Mirrors the TS `Settings` interface (camelCase `playerName`). The MVP holds
/// only the player name used to identify "me" in a live game. Unknown keys are
/// intentionally ignored so older/newer files round-trip without failing.
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Exact in-game name used to identify the local player. Empty when unset.
    #[serde(default)]
    pub player_name: String,
}

/// Filename used for the settings JSON under the app-data dir.
const SETTINGS_FILENAME: &str = "settings.json";

/// Parse settings from JSON text. This is the pure, testable unit (no app
/// handle). Invalid JSON yields a human-readable `Err(String)`.
pub fn parse_settings(contents: &str) -> Result<Settings, String> {
    serde_json::from_str::<Settings>(contents).map_err(|e| e.to_string())
}

/// Serialize settings to pretty JSON text. Infallible for our flat shape, but
/// returns a `Result` to mirror the IO boundary.
pub fn serialize_settings(settings: &Settings) -> Result<String, String> {
    serde_json::to_string_pretty(settings).map_err(|e| e.to_string())
}

/// Read settings from `dir/settings.json`. A missing file returns the default
/// (first run is not an error); a present-but-unparseable file is an error.
pub fn load_from_dir(dir: &Path) -> Result<Settings, String> {
    let path = dir.join(SETTINGS_FILENAME);
    match fs::read_to_string(&path) {
        Ok(contents) => parse_settings(&contents),
        // Missing file (or unreadable) on first run: seed an in-memory default.
        Err(_) => Ok(Settings::default()),
    }
}

/// Write settings to `dir/settings.json`, creating the parent dir if needed.
pub fn save_to_dir(dir: &Path, settings: &Settings) -> Result<(), String> {
    fs::create_dir_all(dir)
        .map_err(|e| format!("cannot create settings dir: {e}"))?;
    let json = serialize_settings(settings)?;
    fs::write(dir.join(SETTINGS_FILENAME), json)
        .map_err(|e| format!("cannot write settings: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new() -> Self {
            static COUNTER: AtomicU32 = AtomicU32::new(0);
            let n = COUNTER.fetch_add(1, Ordering::Relaxed);
            let pid = std::process::id();
            let path = std::env::temp_dir()
                .join(format!("scbox_settings_test_{pid}_{n}"));
            fs::create_dir_all(&path).expect("create temp dir");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[test]
    fn parses_player_name() {
        let s = parse_settings(r#"{ "playerName": "Maru" }"#).unwrap();
        assert_eq!(s.player_name, "Maru");
    }

    #[test]
    fn empty_object_yields_default() {
        let s = parse_settings("{}").unwrap();
        assert_eq!(s, Settings::default());
        assert_eq!(s.player_name, "");
    }

    #[test]
    fn invalid_json_is_error() {
        assert!(parse_settings("{ not valid").is_err());
    }

    #[test]
    fn unknown_keys_are_ignored() {
        let s = parse_settings(r#"{ "playerName": "Sn", "extra": 1 }"#).unwrap();
        assert_eq!(s.player_name, "Sn");
    }

    #[test]
    fn round_trip_serialize_then_parse() {
        let original = Settings {
            player_name: "Serral".to_string(),
        };
        let json = serialize_settings(&original).unwrap();
        let parsed = parse_settings(&json).unwrap();
        assert_eq!(original, parsed);
    }

    #[test]
    fn missing_file_loads_default() {
        let tmp = TempDir::new();
        let dir = tmp.path().join("nope");
        let s = load_from_dir(&dir).expect("default");
        assert_eq!(s, Settings::default());
    }

    #[test]
    fn save_then_load_round_trips_on_disk() {
        let tmp = TempDir::new();
        let dir = tmp.path().join("data");
        let settings = Settings {
            player_name: "Clem".to_string(),
        };
        save_to_dir(&dir, &settings).expect("save");
        let loaded = load_from_dir(&dir).expect("load");
        assert_eq!(loaded, settings);
    }

    #[test]
    fn invalid_file_on_disk_is_error() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join(SETTINGS_FILENAME), "{ bad").unwrap();
        assert!(load_from_dir(tmp.path()).is_err());
    }
}
