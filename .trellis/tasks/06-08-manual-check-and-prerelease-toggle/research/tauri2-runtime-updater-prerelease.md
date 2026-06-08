# Tauri 2 运行时 updater + Pre-release 全自动更新

研究目标：开启 Pre-release 开关时，绕开静态 endpoint，用 Rust 侧自定义 command 查 GitHub 最新（含预发布）release，运行时指定其 latest.json 为 endpoint，验签下载安装。

## A. tauri-plugin-updater 2.10.1 Rust API（已用 docs.rs 核实）

- 依赖现状：`tauri-plugin-updater = "2"`（lock 2.10.1）、`reqwest = "0.12"`（含 json）、`tokio`、`serde_json` 均已在 `src-tauri/Cargo.toml`。无需新增依赖。
- 入口：`use tauri_plugin_updater::UpdaterExt;` 后 `app.updater_builder()`（`UpdaterExt` 扩展了 `AppHandle`）。
- `UpdaterBuilder` 关键方法（docs.rs 确认）：
  - `endpoints(self, endpoints: Vec<Url>) -> Result<Self>` —— **运行时覆盖配置 endpoint**（注意是 `Vec<url::Url>`，非 String；返回 Result）。
  - `pubkey<S: Into<String>>(self, pubkey: S) -> Self` —— 可选；不调用则**自动复用 tauri.conf.json 的 updater.pubkey**（minisign-verify）。
  - `header` / `headers(HeaderMap)` —— 给 endpoint 请求加 header（本场景 latest.json 在 GitHub release 资产，匿名可下，通常不需要）。
  - `version_comparator(Fn(Version, RemoteRelease) -> bool)` —— 自定义"是否算更新"的比较；prerelease 语义化版本若默认比较不接受可用它放宽。
  - `build(self) -> Result<Updater>`。
- 流程骨架：

```rust
use tauri_plugin_updater::UpdaterExt;
use url::Url;

#[tauri::command]
async fn check_prerelease_update(app: tauri::AppHandle) -> Result<Option<String>, String> {
    // 1. 查最新含 prerelease 的 release（见 B），得到 latest.json 资产 URL
    let manifest_url = latest_prerelease_manifest_url().await.map_err(|e| e.to_string())?;
    let url = Url::parse(&manifest_url).map_err(|e| e.to_string())?;

    // 2. 运行时构建 updater，覆盖 endpoint（pubkey 自动取 config）
    let updater = app
        .updater_builder()
        .endpoints(vec![url])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    // 3. check + 安装
    match updater.check().await.map_err(|e| e.to_string())? {
        Some(update) => {
            let ver = update.version.clone();
            update
                .download_and_install(|_chunk, _total| {}, || {})
                .await
                .map_err(|e| e.to_string())?;
            Ok(Some(ver))
        }
        None => Ok(None),
    }
}
```

注：`Update::download_and_install(on_chunk, on_finish)` 两个回调；安装后前端调用 `@tauri-apps/plugin-process` 的 `relaunch()`（与现有 stable 流程一致）。

## B. GitHub Releases API 查最新含 prerelease

- `GET /repos/{owner}/{repo}/releases`（即 NoahCodeGG/scbox-app）返回**数组，按创建时间倒序**，包含 prerelease；**匿名请求不返回 draft**（正好符合需求——草稿不该被用户更新到）。
- `GET /repos/.../releases/latest` 不含 prerelease，故不用它。
- 取"最新"：数组第一个非 draft 即最新发布（含 prerelease）。更稳妥可对 `tag_name` 做 semver 比较挑最大，但倒序取首个通常够用。
- 每个 release 的 `assets[]` 里找 `name == "latest.json"` 的 `browser_download_url`，形如 `https://github.com/<owner>/<repo>/releases/download/<tag>/latest.json`。
- 请求最小形态（reqwest）：必须带 `User-Agent` header（GitHub 强制），匿名速率 60/h（手动检查足够）。

```rust
#[derive(serde::Deserialize)]
struct GhRelease { draft: bool, prerelease: bool, tag_name: String, assets: Vec<GhAsset> }
#[derive(serde::Deserialize)]
struct GhAsset { name: String, browser_download_url: String }

async fn latest_prerelease_manifest_url() -> anyhow::Result<String> {
    let client = reqwest::Client::new();
    let rels: Vec<GhRelease> = client
        .get("https://api.github.com/repos/NoahCodeGG/scbox-app/releases")
        .header("User-Agent", "scbox-app-updater")
        .header("Accept", "application/vnd.github+json")
        .send().await?.error_for_status()?.json().await?;
    let rel = rels.into_iter().find(|r| !r.draft)
        .ok_or_else(|| anyhow::anyhow!("no release"))?;
    rel.assets.into_iter().find(|a| a.name == "latest.json")
        .map(|a| a.browser_download_url)
        .ok_or_else(|| anyhow::anyhow!("no latest.json asset"))
}
```

（注：项目是否已引入 anyhow 待确认；否则用 `Result<_, String>` 或自定义 error。reqwest 已在依赖。）

## C. latest.json 形态（tauri-action 产出）

```json
{
  "version": "0.2.0-beta.1",
  "notes": "...",
  "pub_date": "2026-..Z",
  "platforms": {
    "darwin-aarch64": { "signature": "<minisign>", "url": "https://github.com/.../releases/download/<tag>/SCBox.Assistant_x.y.z_aarch64.app.tar.gz" },
    "windows-x86_64": { "signature": "...", "url": ".../<tag>/SCBox.Assistant_x.y.z_x64-setup.exe" }
  }
}
```

prerelease 的 latest.json 里 url 指向**该 prerelease 自己**的资产，updater 可直接下载。signature 用同一 `TAURI_SIGNING_PRIVATE_KEY`（CI 一致），故 config pubkey 能验签通过。

## D. 风险 / 坑

1. **运行时 endpoint 生效**：`updater_builder().endpoints()` 是官方支持的运行时覆盖方式，确认可行。
2. **版本比较**：updater 默认只装"更高版本"。prerelease 如 `0.2.0-beta.1` semver 上 > `0.1.0`，正常会被接受；但同主版本的 prerelease 互比（如已在 beta.1 检查 beta.2）若有问题，用 `version_comparator` 放宽。
3. **stable 通道现状**：开关关时仍走 JS `check()` 静态 endpoint `releases/latest/...`；**该 release 仍是 draft → 必然 404**（截图报错即此）。需 publish 才能用，属运维。
4. **签名一致性**：只要 CI 始终用同一私钥，prerelease 与 stable 都能用 config pubkey 验签。
5. **GitHub 匿名速率**：60/h，手动检查无忧；不要做高频轮询。
6. **draft 不出现在匿名 API**：符合预期（用户不会被更新到草稿）。

## 实现落点（前后端）

- **Rust** `src-tauri/`：新增 command（建议放 `src/updater.rs` 或 lib.rs），注册进 `generate_handler!`（lib.rs:194）。capabilities 已有 `updater:default`、`process:allow-restart`；GitHub API 走 Rust reqwest，无需前端 http 权限。
- **settings**：`prereleaseUpdates: bool` 默认 false —— TS `useSettings.ts`（Settings + DEFAULT_SETTINGS）、`lib/settings.ts` normalizeSettings 透传、Rust `settings.rs`（serde camelCase + default + 测试）。
- **前端** `useUpdateCheck.ts`：检查时若 `prereleaseUpdates` 开 → `invoke("check_prerelease_update")`；否则现有 `check()`。`SettingsPanel.tsx`：①手动检查按钮改高亮主按钮样式；②加 Pre-release Switch（draft → 保存持久化）。
