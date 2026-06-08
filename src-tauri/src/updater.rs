//! Pre-release auto-update path.
//!
//! Tauri's `tauri-plugin-updater` `check()` only resolves the static
//! `releases/latest` endpoint configured in `tauri.conf.json`, which excludes
//! pre-releases. To let opt-in users ride the beta channel we query the GitHub
//! Releases API directly for the newest published release (drafts never appear
//! for anonymous callers), point the updater at *that* release's `latest.json`
//! manifest at runtime via `updater_builder().endpoints(...)`, and reuse the
//! config pubkey for minisign verification.
//!
//! The stable channel (toggle off) keeps using the JS `check()` flow; this
//! module is only reached when `prereleaseUpdates` is enabled.

use serde::Deserialize;
use tauri_plugin_updater::UpdaterExt;
use url::Url;

/// GitHub Releases API endpoint for this repository. Returns releases newest
/// first and (for anonymous requests) omits drafts.
const GITHUB_RELEASES_API: &str =
    "https://api.github.com/repos/NoahCodeGG/scbox-app/releases";

/// Asset filename produced by `tauri-action` that the updater consumes.
const MANIFEST_ASSET_NAME: &str = "latest.json";

/// GitHub requires a `User-Agent` on every API request.
const GITHUB_USER_AGENT: &str = "scbox-app-updater";

/// A subset of the GitHub release object — only the fields we need.
#[derive(Debug, Deserialize)]
struct GhRelease {
    draft: bool,
    assets: Vec<GhAsset>,
}

/// A subset of a GitHub release asset.
#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

/// Resolve the `latest.json` manifest URL of the newest published release
/// (including pre-releases). Returns a clear `Err(String)` for any failure mode
/// (network, empty list, missing manifest asset) so the frontend can surface it.
async fn latest_manifest_url() -> Result<String, String> {
    let client = reqwest::Client::new();
    let releases: Vec<GhRelease> = client
        .get(GITHUB_RELEASES_API)
        .header("User-Agent", GITHUB_USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await
        .map_err(|e| format!("无法请求 GitHub releases：{e}"))?
        .error_for_status()
        .map_err(|e| format!("GitHub releases 请求失败：{e}"))?
        .json()
        .await
        .map_err(|e| format!("无法解析 GitHub releases 响应：{e}"))?;

    // The API returns releases newest-first; the first non-draft is the newest
    // published release (which may be a pre-release).
    let release = releases
        .into_iter()
        .find(|r| !r.draft)
        .ok_or_else(|| "GitHub 上没有已发布的版本".to_string())?;

    release
        .assets
        .into_iter()
        .find(|a| a.name == MANIFEST_ASSET_NAME)
        .map(|a| a.browser_download_url)
        .ok_or_else(|| {
            format!("最新发布缺少 {MANIFEST_ASSET_NAME} 资产，无法更新")
        })
}

/// Check the pre-release channel and, if a newer signed version exists, download
/// and install it. Returns `Ok(Some(version))` when an update was installed (the
/// frontend then relaunches), `Ok(None)` when already up to date, or `Err` with
/// a user-readable message on any failure. Never panics on recoverable input.
#[tauri::command]
pub async fn check_prerelease_update(
    app: tauri::AppHandle,
) -> Result<Option<String>, String> {
    let manifest_url = latest_manifest_url().await?;
    let url = Url::parse(&manifest_url)
        .map_err(|e| format!("无效的更新清单地址：{e}"))?;

    // Build an updater at runtime pointed at the pre-release manifest. The
    // pubkey is reused from tauri.conf.json automatically (minisign-verify).
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| format!("无法配置更新源：{e}"))?
        .build()
        .map_err(|e| format!("无法构建更新器：{e}"))?;

    match updater
        .check()
        .await
        .map_err(|e| format!("检查预发布更新失败：{e}"))?
    {
        Some(update) => {
            let version = update.version.clone();
            update
                .download_and_install(|_chunk, _total| {}, || {})
                .await
                .map_err(|e| format!("下载或安装更新失败：{e}"))?;
            Ok(Some(version))
        }
        None => Ok(None),
    }
}
