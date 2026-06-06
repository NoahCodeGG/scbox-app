//! App settings persistence in the app-data directory.
//!
//! Settings live in a single user-editable JSON file (`settings.json`) under the
//! OS app-data dir, mirroring the build-order IO pattern in `builds.rs`. The
//! on-disk shape is the cross-layer contract mirrored by `Settings` in
//! `src/hooks/useSettings.ts` — keep the (camelCase) field names in sync.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// Default SC2 Client API port (localhost `-clientapi <port>`).
pub const DEFAULT_CLIENT_API_PORT: u16 = 6119;
/// Default Web Speech utterance rate.
const DEFAULT_VOICE_RATE: f64 = 1.0;

fn default_client_api_port() -> u16 {
    DEFAULT_CLIENT_API_PORT
}

fn default_voice_enabled() -> bool {
    true
}

fn default_voice_rate() -> f64 {
    DEFAULT_VOICE_RATE
}

fn default_click_through() -> bool {
    false
}

/// User-editable application settings.
///
/// Mirrors the TS `Settings` interface (camelCase keys). Every field carries a
/// serde default so an older `settings.json` (e.g. only `playerName`) still
/// loads, with the missing knobs falling back to their defaults. Unknown keys
/// are intentionally ignored so older/newer files round-trip without failing.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    /// Exact in-game name used to identify the local player. Empty when unset.
    #[serde(default)]
    pub player_name: String,
    /// SC2 Client API port the poll loop hits (`-clientapi <port>`).
    #[serde(default = "default_client_api_port")]
    pub client_api_port: u16,
    /// When set, overrides each build's `leadTimeSec`; `None` uses the build's.
    #[serde(default)]
    pub lead_time_sec_override: Option<f64>,
    /// Whether build-order voice cues are spoken at all.
    #[serde(default = "default_voice_enabled")]
    pub voice_enabled: bool,
    /// Web Speech utterance rate (clamped 0.5–2.0 by the frontend).
    #[serde(default = "default_voice_rate")]
    pub voice_rate: f64,
    /// Whether the overlay window passes clicks through to the game.
    #[serde(default = "default_click_through")]
    pub click_through: bool,
    /// Persisted window X position (logical pixels). `None` uses Tauri's default.
    #[serde(default)]
    pub window_x: Option<f64>,
    /// Persisted window Y position (logical pixels). `None` uses Tauri's default.
    #[serde(default)]
    pub window_y: Option<f64>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            player_name: String::new(),
            client_api_port: DEFAULT_CLIENT_API_PORT,
            lead_time_sec_override: None,
            voice_enabled: true,
            voice_rate: DEFAULT_VOICE_RATE,
            click_through: false,
            window_x: None,
            window_y: None,
        }
    }
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
    fn old_file_with_only_player_name_gets_new_defaults() {
        // Back-compat: a settings.json written before the new knobs existed
        // must load, with each missing field taking its default.
        let s = parse_settings(r#"{ "playerName": "Maru" }"#).unwrap();
        assert_eq!(s.player_name, "Maru");
        assert_eq!(s.client_api_port, DEFAULT_CLIENT_API_PORT);
        assert_eq!(s.lead_time_sec_override, None);
        assert!(s.voice_enabled);
        assert_eq!(s.voice_rate, 1.0);
        assert!(!s.click_through);
        assert_eq!(s.window_x, None);
        assert_eq!(s.window_y, None);
    }

    #[test]
    fn default_has_non_zero_port_and_rate() {
        let s = Settings::default();
        assert_eq!(s.client_api_port, 6119);
        assert!(s.voice_enabled);
        assert_eq!(s.voice_rate, 1.0);
        assert_eq!(s.lead_time_sec_override, None);
        assert!(!s.click_through);
        assert_eq!(s.window_x, None);
        assert_eq!(s.window_y, None);
    }

    #[test]
    fn parses_all_new_fields() {
        let json = r#"{
            "playerName": "Sn",
            "clientApiPort": 5000,
            "leadTimeSecOverride": 2.5,
            "voiceEnabled": false,
            "voiceRate": 1.5,
            "clickThrough": true,
            "windowX": 100.0,
            "windowY": 200.0
        }"#;
        let s = parse_settings(json).unwrap();
        assert_eq!(s.client_api_port, 5000);
        assert_eq!(s.lead_time_sec_override, Some(2.5));
        assert!(!s.voice_enabled);
        assert_eq!(s.voice_rate, 1.5);
        assert!(s.click_through);
        assert_eq!(s.window_x, Some(100.0));
        assert_eq!(s.window_y, Some(200.0));
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
            client_api_port: 6120,
            lead_time_sec_override: Some(3.0),
            voice_enabled: false,
            voice_rate: 1.25,
            click_through: true,
            window_x: Some(150.0),
            window_y: Some(250.0),
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
            ..Settings::default()
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
