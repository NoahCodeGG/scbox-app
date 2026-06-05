//! Build-order loading from the app-data directory.
//!
//! Build orders are user-editable JSON files living under the OS app-data
//! `builds/` dir, so they can be changed after the app is packaged. On first
//! run we seed a bundled default. The on-disk shape is the cross-layer contract
//! mirrored by `src/types/build.ts` — keep the (camelCase) field names in sync.

use std::fs;
use std::path::Path;

use serde::{Deserialize, Serialize};

/// The bundled default build, the single source of truth for both seeding the
/// app-data dir on first run and the frontend's in-memory fallback. Referenced
/// relatively from this module so there is only one copy of the JSON.
pub const DEFAULT_BUILD_JSON: &str =
    include_str!("../../src/data/builds/terran-standard.json");

/// Filename used when seeding the bundled default build.
const DEFAULT_BUILD_FILENAME: &str = "terran-standard.json";

/// One build-order cue keyed to the in-game clock.
///
/// Mirrors `BuildStep` in `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildStep {
    /// Target `displayTime` (seconds) for the action.
    pub time: f64,
    /// Text spoken when the step is due.
    pub say: String,
}

/// A full build order for one matchup.
///
/// Mirrors `BuildOrder` in `src/types/build.ts`. Unknown keys (e.g. the doc-only
/// `_note`) are intentionally ignored — do NOT add `deny_unknown_fields`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildOrder {
    /// e.g. "TvP". Display/identification only in the MVP.
    pub matchup: String,
    /// Player race this build is authored for.
    pub race: String,
    /// Seconds to announce a step ahead of its `time`.
    pub lead_time_sec: f64,
    /// Cues in (expected) ascending `time` order.
    pub steps: Vec<BuildStep>,
}

/// Result of scanning a builds directory: the valid builds plus a human-readable
/// error per file that failed to parse. Mirrors `LoadResult` in
/// `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoadResult {
    pub builds: Vec<BuildOrder>,
    pub errors: Vec<String>,
}

/// Read every `*.json` in `dir`, parsing each into a `BuildOrder`.
///
/// Valid files contribute to `builds`; an unparseable file contributes a
/// `"<filename>: <error>"` string to `errors` rather than failing the whole
/// load. A missing directory yields an empty result with no errors. This is the
/// pure, testable unit (no app handle).
pub fn load_from_dir(dir: &Path) -> LoadResult {
    let mut result = LoadResult::default();

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        // Missing dir is not an error here: seeding is the caller's job.
        Err(_) => return result,
    };

    // Collect paths first so the output order is deterministic (sorted).
    let mut json_paths: Vec<_> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.extension().and_then(|ext| ext.to_str()) == Some("json")
        })
        .collect();
    json_paths.sort();

    for path in json_paths {
        let filename = path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("<unknown>")
            .to_string();

        match fs::read_to_string(&path) {
            Ok(contents) => match serde_json::from_str::<BuildOrder>(&contents) {
                Ok(build) => result.builds.push(build),
                Err(e) => result.errors.push(format!("{filename}: {e}")),
            },
            Err(e) => result.errors.push(format!("{filename}: {e}")),
        }
    }

    result
}

/// Ensure `dir` exists and holds at least one build, seeding the bundled default
/// when it is absent or contains no `*.json` files. Idempotent: an already
/// populated dir is left untouched.
pub fn seed_if_empty(dir: &Path) -> std::io::Result<()> {
    if has_any_json(dir) {
        return Ok(());
    }
    fs::create_dir_all(dir)?;
    let target = dir.join(DEFAULT_BUILD_FILENAME);
    fs::write(target, DEFAULT_BUILD_JSON)?;
    Ok(())
}

/// Whether `dir` exists and contains at least one `*.json` file.
fn has_any_json(dir: &Path) -> bool {
    match fs::read_dir(dir) {
        Ok(entries) => entries.filter_map(|e| e.ok()).any(|e| {
            e.path().extension().and_then(|ext| ext.to_str()) == Some("json")
        }),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A unique temp dir under the OS temp dir, removed on drop. Avoids adding a
    /// `tempfile` dependency for these small tests.
    struct TempDir {
        path: std::path::PathBuf,
    }

    impl TempDir {
        fn new() -> Self {
            static COUNTER: AtomicU32 = AtomicU32::new(0);
            let n = COUNTER.fetch_add(1, Ordering::Relaxed);
            let pid = std::process::id();
            let path = std::env::temp_dir()
                .join(format!("scbox_builds_test_{pid}_{n}"));
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

    const VALID_BUILD: &str = r#"{
        "matchup": "TvP",
        "race": "Terran",
        "leadTimeSec": 4,
        "steps": [{ "time": 17, "say": "supply" }]
    }"#;

    #[test]
    fn loads_two_valid_builds() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("a.json"), VALID_BUILD).unwrap();
        fs::write(tmp.path().join("b.json"), VALID_BUILD).unwrap();

        let result = load_from_dir(tmp.path());
        assert_eq!(result.builds.len(), 2);
        assert!(result.errors.is_empty());
    }

    #[test]
    fn seed_then_load_yields_default_build() {
        let tmp = TempDir::new();
        // Use a fresh, currently-empty subdir to exercise the "absent" path too.
        let dir = tmp.path().join("builds");

        seed_if_empty(&dir).expect("seed");
        let result = load_from_dir(&dir);

        assert_eq!(result.builds.len(), 1);
        assert!(result.errors.is_empty());
        assert_eq!(result.builds[0].race, "Terran");
    }

    #[test]
    fn seed_is_idempotent() {
        let tmp = TempDir::new();
        let dir = tmp.path().join("builds");
        seed_if_empty(&dir).expect("seed once");
        seed_if_empty(&dir).expect("seed twice");
        let result = load_from_dir(&dir);
        assert_eq!(result.builds.len(), 1);
    }

    #[test]
    fn one_invalid_among_valid_reports_error_and_keeps_valid() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("good.json"), VALID_BUILD).unwrap();
        fs::write(tmp.path().join("bad.json"), "{ not valid json").unwrap();

        let result = load_from_dir(tmp.path());
        assert_eq!(result.builds.len(), 1);
        assert_eq!(result.errors.len(), 1);
        assert!(result.errors[0].starts_with("bad.json:"));
    }

    #[test]
    fn missing_dir_is_empty_not_error() {
        let tmp = TempDir::new();
        let missing = tmp.path().join("does-not-exist");
        let result = load_from_dir(&missing);
        assert!(result.builds.is_empty());
        assert!(result.errors.is_empty());
    }

    #[test]
    fn doc_only_unknown_keys_are_ignored() {
        let tmp = TempDir::new();
        let with_note = r#"{
            "_note": "doc only",
            "matchup": "TvZ",
            "race": "Terran",
            "leadTimeSec": 4,
            "steps": []
        }"#;
        fs::write(tmp.path().join("noted.json"), with_note).unwrap();
        let result = load_from_dir(tmp.path());
        assert_eq!(result.builds.len(), 1);
        assert!(result.errors.is_empty());
    }
}
