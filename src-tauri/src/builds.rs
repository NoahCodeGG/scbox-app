//! Build-order loading: read-only embedded defaults merged with the user's
//! editable JSON files.
//!
//! Default builds are compiled into the binary from the repo's
//! `src/data/builds/` dir (`include_dir!`), so they ship with the app and update
//! with each release — they are never written to disk. User builds live under
//! the OS app-data `builds/` dir and are fully editable; the app NEVER overwrites
//! them. On load we clean up any pristine (untouched) seed files left by the old
//! seed-on-first-run model, then merge defaults + user builds. The on-disk shape
//! is the cross-layer contract mirrored by `src/types/build.ts` — keep the
//! (camelCase) field names in sync.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use include_dir::{include_dir, Dir};
use serde::{Deserialize, Serialize};

/// Read-only default builds, compiled into the binary from the repo's
/// `src/data/builds/` dir. They ship with the app and update with each release.
static DEFAULT_BUILDS: Dir<'_> =
    include_dir!("$CARGO_MANIFEST_DIR/../src/data/builds");

/// Exact bytes of a seed file the app shipped (and copied into the user's builds
/// dir) under the old seed-on-first-run model. Used to recognise an untouched
/// (pristine) seed so it can be removed when migrating to embedded defaults. A
/// user file whose bytes differ (i.e. was edited) never matches and is kept.
const LEGACY_SEED_TERRAN: &str = include_str!("legacy_seed_terran.json");

/// One build-order cue keyed to the in-game clock.
///
/// Mirrors `BuildStep` in `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BuildStep {
    /// Target `displayTime` (seconds) for the action.
    pub time: f64,
    /// Text shown in the UI when the step is due.
    pub say: String,
    /// Optional spoken override. When present and non-empty, TTS reads it
    /// verbatim instead of `say`. Absent in older files → `None`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub say_as: Option<String>,
}

/// A recurring discipline reminder (e.g. Zerg inject/creep) that fires every
/// `interval_sec` starting at `start_sec`, optionally stopping at `end_sec`.
/// Runs independently of the linear build `steps`.
///
/// Mirrors `RecurringCue` in `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurringCue {
    /// First trigger's target `displayTime` (seconds).
    pub start_sec: f64,
    /// Seconds between repeats (must be > 0).
    pub interval_sec: f64,
    /// Optional last `displayTime` to keep firing through. Absent → until game
    /// end.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub end_sec: Option<f64>,
    /// Text shown in the UI when due.
    pub say: String,
    /// Optional spoken override; same semantics as `BuildStep::say_as`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub say_as: Option<String>,
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
    /// Human-readable label, e.g. "TvZ 两船兵". Absent in older files → empty
    /// string; the UI falls back to `matchup` for display.
    #[serde(default)]
    pub name: String,
    /// Seconds to announce a step ahead of its `time`.
    pub lead_time_sec: f64,
    /// Cues in (expected) ascending `time` order.
    pub steps: Vec<BuildStep>,
    /// Parallel recurring discipline reminders that run independently of
    /// `steps`. Absent in older files → `None`; not serialized when `None` to
    /// keep existing file output unchanged.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recurring: Option<Vec<RecurringCue>>,
}

/// A loaded build paired with the name of the file it came from. The filename is
/// loader metadata (not part of the on-disk JSON), letting the editor save or
/// delete the right file. Mirrors `StoredBuild` in `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredBuild {
    /// Source filename, e.g. `"tvz.json"`.
    pub filename: String,
    /// The parsed build order.
    pub build: BuildOrder,
    /// True for embedded defaults (cannot be edited/deleted in place); false for
    /// user files under the app-data builds dir.
    pub read_only: bool,
}

/// Result of a build load: the valid builds (each paired with its source
/// filename) plus a human-readable error per file that failed to parse.
/// Mirrors `LoadResult` in `src/types/build.ts`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LoadResult {
    pub builds: Vec<StoredBuild>,
    pub errors: Vec<String>,
}

/// Parse the embedded read-only default builds, sorted by filename. Returns the
/// parsed builds plus a per-file error for any default that fails to parse.
fn embedded_defaults() -> (Vec<StoredBuild>, Vec<String>) {
    let mut builds = Vec::new();
    let mut errors = Vec::new();

    let mut files: Vec<_> = DEFAULT_BUILDS
        .files()
        .filter(|f| {
            f.path().extension().and_then(|e| e.to_str()) == Some("json")
        })
        .collect();
    files.sort_by(|a, b| a.path().cmp(b.path()));

    for file in files {
        let filename = file
            .path()
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or("<unknown>")
            .to_string();
        match file.contents_utf8() {
            Some(contents) => match serde_json::from_str::<BuildOrder>(contents) {
                Ok(build) => builds.push(StoredBuild {
                    filename,
                    build,
                    read_only: true,
                }),
                Err(e) => errors.push(format!("{filename}: {e}")),
            },
            None => errors.push(format!("{filename}: not valid UTF-8")),
        }
    }

    (builds, errors)
}

/// Byte-exact fingerprints of pristine shipped seeds: every current embedded
/// default plus known legacy seeds. A user file matching any of these is an
/// untouched copy safe to remove during migration.
fn pristine_fingerprints() -> Vec<String> {
    let mut fps: Vec<String> = DEFAULT_BUILDS
        .files()
        .filter_map(|f| f.contents_utf8())
        .map(str::to_string)
        .collect();
    fps.push(LEGACY_SEED_TERRAN.to_string());
    fps
}

/// Remove any `*.json` in `dir` whose contents byte-match a pristine shipped
/// seed (see [`pristine_fingerprints`]). User-edited files have different bytes
/// and are left untouched. A missing dir is a no-op. Returns the removed names.
pub fn cleanup_pristine(dir: &Path) -> Vec<String> {
    let fingerprints = pristine_fingerprints();
    let mut removed = Vec::new();

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return removed,
    };

    let mut paths: Vec<_> = entries
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|path| {
            path.extension().and_then(|ext| ext.to_str()) == Some("json")
        })
        .collect();
    paths.sort();

    for path in paths {
        let Ok(contents) = fs::read_to_string(&path) else {
            continue;
        };
        if fingerprints.iter().any(|fp| fp == &contents) && fs::remove_file(&path).is_ok() {
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                removed.push(name.to_string());
            }
        }
    }

    removed
}

/// Read every `*.json` in `dir` as a user (editable) build.
///
/// Valid files contribute to `builds` (with `read_only: false`); an unparseable
/// file contributes a `"<filename>: <error>"` string to `errors` rather than
/// failing the whole load. A missing directory yields an empty result. This is
/// the pure, testable unit (no app handle).
pub fn load_from_dir(dir: &Path) -> LoadResult {
    let mut result = LoadResult::default();

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
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
                Ok(build) => result.builds.push(StoredBuild {
                    filename,
                    build,
                    read_only: false,
                }),
                Err(e) => result.errors.push(format!("{filename}: {e}")),
            },
            Err(e) => result.errors.push(format!("{filename}: {e}")),
        }
    }

    result
}

/// Full build load: clean pristine seeds in `user_dir`, then merge embedded
/// read-only defaults with the user's editable builds. On a filename collision
/// the user file wins (defensive — filenames are normally deduped at creation so
/// a user build never shares a default's name). Output is defaults-first then
/// user builds, each group sorted by filename.
pub fn load_builds(user_dir: &Path) -> LoadResult {
    cleanup_pristine(user_dir);

    let (defaults, mut errors) = embedded_defaults();
    let user = load_from_dir(user_dir);
    errors.extend(user.errors);

    let user_names: HashSet<String> = user
        .builds
        .iter()
        .map(|b| b.filename.to_lowercase())
        .collect();

    let mut builds: Vec<StoredBuild> = defaults
        .into_iter()
        .filter(|d| !user_names.contains(&d.filename.to_lowercase()))
        .collect();
    builds.extend(user.builds);

    LoadResult { builds, errors }
}

/// Validate a build filename coming from the (untrusted) frontend before using
/// it to build a path. Rejects anything that could escape the builds dir or is
/// not a plain `*.json` file: path separators, `..`, empty names, or a missing
/// `.json` extension. Returns the validated filename on success.
///
/// This is the security boundary for `save_build_order` / `delete_build_order`:
/// the frontend can send any string, so the path is only ever `dir.join(name)`
/// with `name` guaranteed to be a single, json-suffixed path component.
pub fn sanitize_filename(filename: &str) -> Result<&str, String> {
    if filename.is_empty() {
        return Err("filename is empty".to_string());
    }
    if filename.contains('/')
        || filename.contains('\\')
        || filename.contains("..")
        || filename.contains('\0')
    {
        return Err(format!("illegal filename: {filename}"));
    }
    // Reject names that resolve to more than one component (also catches
    // absolute paths and drive prefixes on Windows).
    if Path::new(filename).components().count() != 1 {
        return Err(format!("illegal filename: {filename}"));
    }
    if !filename.ends_with(".json") {
        return Err(format!("filename must end with .json: {filename}"));
    }
    Ok(filename)
}

/// Write `build` as pretty JSON to `dir/<filename>`, creating `dir` if needed.
/// `filename` is validated via [`sanitize_filename`] first. The pure, testable
/// unit behind the `save_build_order` command (no app handle).
pub fn save_to_dir(
    dir: &Path,
    filename: &str,
    build: &BuildOrder,
) -> Result<(), String> {
    let name = sanitize_filename(filename)?;
    fs::create_dir_all(dir)
        .map_err(|e| format!("cannot create builds dir: {e}"))?;
    let json = serde_json::to_string_pretty(build)
        .map_err(|e| format!("cannot serialize build: {e}"))?;
    fs::write(dir.join(name), json)
        .map_err(|e| format!("cannot write {name}: {e}"))
}

/// Delete `dir/<filename>`. `filename` is validated via [`sanitize_filename`].
/// A missing file is treated as success (idempotent delete). The pure, testable
/// unit behind the `delete_build_order` command (no app handle).
pub fn delete_from_dir(dir: &Path, filename: &str) -> Result<(), String> {
    let name = sanitize_filename(filename)?;
    match fs::remove_file(dir.join(name)) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("cannot delete {name}: {e}")),
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
        "name": "user build",
        "leadTimeSec": 4,
        "steps": [{ "time": 17, "say": "supply" }]
    }"#;

    #[test]
    fn embedded_defaults_parse_and_are_read_only() {
        let (builds, errors) = embedded_defaults();
        assert!(errors.is_empty(), "default builds must parse: {errors:?}");
        assert!(!builds.is_empty(), "expected at least one embedded default");
        assert!(builds.iter().all(|b| b.read_only));
        // The shipped TvZ default is present.
        assert!(builds.iter().any(|b| b.filename == "tvz-两船兵.json"));
    }

    #[test]
    fn load_builds_includes_defaults_when_user_dir_empty() {
        let tmp = TempDir::new();
        let dir = tmp.path().join("builds"); // missing dir
        let result = load_builds(&dir);
        assert!(result.errors.is_empty());
        assert!(!result.builds.is_empty());
        assert!(result.builds.iter().all(|b| b.read_only));
    }

    #[test]
    fn load_builds_merges_user_builds_as_writable() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("mine.json"), VALID_BUILD).unwrap();

        let result = load_builds(tmp.path());
        let (defaults, _) = embedded_defaults();
        assert_eq!(result.builds.len(), defaults.len() + 1);

        let mine = result
            .builds
            .iter()
            .find(|b| b.filename == "mine.json")
            .expect("user build present");
        assert!(!mine.read_only);
        assert_eq!(mine.build.name, "user build");
    }

    #[test]
    fn user_file_overrides_same_named_default() {
        let tmp = TempDir::new();
        // Shadow an embedded default by filename.
        fs::write(tmp.path().join("tvz-两船兵.json"), VALID_BUILD).unwrap();

        let result = load_builds(tmp.path());
        let matching: Vec<_> = result
            .builds
            .iter()
            .filter(|b| b.filename == "tvz-两船兵.json")
            .collect();
        assert_eq!(matching.len(), 1, "no duplicate filename");
        assert!(!matching[0].read_only, "user copy wins, is writable");
    }

    #[test]
    fn cleanup_removes_pristine_legacy_seed() {
        let tmp = TempDir::new();
        // A byte-exact copy of the old shipped seed = pristine.
        fs::write(tmp.path().join("terran-standard.json"), LEGACY_SEED_TERRAN)
            .unwrap();

        let removed = cleanup_pristine(tmp.path());
        assert_eq!(removed, vec!["terran-standard.json".to_string()]);
        assert!(!tmp.path().join("terran-standard.json").exists());
    }

    #[test]
    fn cleanup_keeps_edited_seed() {
        let tmp = TempDir::new();
        let edited = LEGACY_SEED_TERRAN.replace("Terran", "Protoss");
        fs::write(tmp.path().join("terran-standard.json"), &edited).unwrap();

        let removed = cleanup_pristine(tmp.path());
        assert!(removed.is_empty());
        assert!(tmp.path().join("terran-standard.json").exists());
    }

    #[test]
    fn load_builds_cleans_pristine_then_shows_default() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("terran-standard.json"), LEGACY_SEED_TERRAN)
            .unwrap();

        let result = load_builds(tmp.path());
        // The pristine seed is gone; only read-only defaults remain.
        assert!(!tmp.path().join("terran-standard.json").exists());
        assert!(result.builds.iter().all(|b| b.read_only));
    }

    #[test]
    fn load_from_dir_marks_user_builds_writable() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("a.json"), VALID_BUILD).unwrap();
        let result = load_from_dir(tmp.path());
        assert_eq!(result.builds.len(), 1);
        assert!(!result.builds[0].read_only);
        assert_eq!(result.builds[0].filename, "a.json");
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

    #[test]
    fn missing_name_defaults_to_empty() {
        let tmp = TempDir::new();
        let no_name = r#"{
            "matchup": "TvZ",
            "race": "Terran",
            "leadTimeSec": 4,
            "steps": []
        }"#;
        fs::write(tmp.path().join("noname.json"), no_name).unwrap();
        let result = load_from_dir(tmp.path());
        assert_eq!(result.builds.len(), 1);
        assert_eq!(result.builds[0].build.name, "");
    }

    #[test]
    fn sanitize_accepts_plain_json_name() {
        assert_eq!(sanitize_filename("tvp.json").unwrap(), "tvp.json");
        assert_eq!(sanitize_filename("my-build_1.json").unwrap(), "my-build_1.json");
    }

    #[test]
    fn sanitize_rejects_traversal_and_separators() {
        assert!(sanitize_filename("").is_err());
        assert!(sanitize_filename("../evil.json").is_err());
        assert!(sanitize_filename("sub/dir.json").is_err());
        assert!(sanitize_filename("a\\b.json").is_err());
        assert!(sanitize_filename("/abs.json").is_err());
        assert!(sanitize_filename("no-ext").is_err());
        assert!(sanitize_filename("nul\0.json").is_err());
    }

    #[test]
    fn save_then_load_round_trips() {
        let tmp = TempDir::new();
        let dir = tmp.path().join("builds");
        let build = BuildOrder {
            matchup: "TvZ".to_string(),
            race: "Terran".to_string(),
            name: "my tvz".to_string(),
            lead_time_sec: 4.0,
            steps: vec![
                BuildStep { time: 17.0, say: "depot".to_string(), say_as: None },
                BuildStep { time: 30.0, say: "rax".to_string(), say_as: None },
            ],
            recurring: None,
        };

        save_to_dir(&dir, "tvz.json", &build).expect("save");
        let result = load_from_dir(&dir);

        assert_eq!(result.builds.len(), 1);
        let loaded = &result.builds[0];
        assert_eq!(loaded.filename, "tvz.json");
        assert_eq!(loaded.build.name, "my tvz");
        assert_eq!(loaded.build.steps.len(), 2);
        assert!(!loaded.read_only);
    }

    #[test]
    fn save_rejects_illegal_filename() {
        let tmp = TempDir::new();
        let build = BuildOrder {
            matchup: "TvP".to_string(),
            race: "Terran".to_string(),
            name: "x".to_string(),
            lead_time_sec: 4.0,
            steps: vec![],
            recurring: None,
        };
        assert!(save_to_dir(tmp.path(), "../escape.json", &build).is_err());
    }

    #[test]
    fn recurring_field_round_trips_through_serde() {
        let with_recurring = r#"{
            "matchup": "ZvP",
            "race": "Zerg",
            "name": "inject build",
            "leadTimeSec": 4,
            "steps": [{ "time": 17, "say": "extractor" }],
            "recurring": [
                { "startSec": 60, "intervalSec": 29, "say": "注卵" },
                { "startSec": 120, "intervalSec": 40, "endSec": 600, "say": "菌毯", "sayAs": "铺菌毯" }
            ]
        }"#;

        let order: BuildOrder =
            serde_json::from_str(with_recurring).expect("parse recurring build");
        let recurring = order.recurring.as_ref().expect("recurring preserved");
        assert_eq!(recurring.len(), 2);
        assert_eq!(recurring[0].start_sec, 60.0);
        assert_eq!(recurring[0].interval_sec, 29.0);
        assert_eq!(recurring[0].end_sec, None);
        assert_eq!(recurring[1].end_sec, Some(600.0));
        assert_eq!(recurring[1].say_as.as_deref(), Some("铺菌毯"));

        // Re-serialize and confirm the camelCase keys survive the round-trip.
        let json = serde_json::to_string(&order).expect("serialize");
        assert!(json.contains("\"recurring\""));
        assert!(json.contains("\"startSec\""));
        assert!(json.contains("\"intervalSec\""));
        assert!(json.contains("\"endSec\""));
        assert!(json.contains("\"sayAs\""));
    }

    #[test]
    fn absent_recurring_is_omitted_on_serialize() {
        let build = BuildOrder {
            matchup: "TvP".to_string(),
            race: "Terran".to_string(),
            name: "x".to_string(),
            lead_time_sec: 4.0,
            steps: vec![],
            recurring: None,
        };
        let json = serde_json::to_string(&build).expect("serialize");
        assert!(!json.contains("recurring"));
    }

    #[test]
    fn delete_removes_file_and_is_idempotent() {
        let tmp = TempDir::new();
        fs::write(tmp.path().join("gone.json"), VALID_BUILD).unwrap();

        delete_from_dir(tmp.path(), "gone.json").expect("first delete");
        assert!(!tmp.path().join("gone.json").exists());
        // Deleting a missing file is not an error.
        delete_from_dir(tmp.path(), "gone.json").expect("idempotent delete");
    }

    #[test]
    fn delete_rejects_illegal_filename() {
        let tmp = TempDir::new();
        assert!(delete_from_dir(tmp.path(), "../escape.json").is_err());
    }
}
