# 手动检查更新 + Pre-release 更新开关

## Goal

让用户能手动触发更新检查，并可选地把"预发布版本（pre-release）"纳入更新检查范围。

## What I already know

* **手动检查按钮已存在**：`SettingsPanel.tsx:371-384`，面板底部，调用 `onCheckUpdate()`，状态文案见 `updateStatusText()`（行48-60：检查中/检查失败/有新版本/已是最新）。逻辑在 `useUpdateCheck.ts`（`@tauri-apps/plugin-updater` 的 `check()`）。
* **updater endpoint**：`tauri.conf.json` plugins.updater = `https://github.com/NoahCodeGG/scbox-app/releases/latest/download/latest.json`，静态 `releases/latest` 模式，只解析正式 release，不含 prerelease/draft。
* **settings 加字段需改**：TS `useSettings.ts:12-49`（Settings + DEFAULT_SETTINGS）、`lib/settings.ts:102` normalizeSettings 逐字段透传、Rust `settings.rs:52-100`（serde camelCase + #[serde(default)] + Default impl + 测试）。
* **现有 Switch 范例**：`SettingsPanel.tsx:260-271`（语音播报开关，写本地 draft，点保存才持久化）。
* **release 工作流**：`.github/workflows/release.yml` 用 `tauri-action@v0`，`releaseDraft: true`，每个 release 自带 latest.json 资产。
* **Tauri 限制**：`check()` 不支持运行时传 prerelease 标志/切 endpoint；endpoints 占位符无 prerelease 维度。要支持 prerelease 必须绕开插件静态 endpoint（自建 GitHub Releases API 查询）。

## Open Questions

* （已解决）手动按钮诉求：把现有"检查更新"做成**明显可点的高亮按钮**（用户误以为是标题，因样式太弱）。
* （已解决）prerelease 路径：**全自动安装**（GitHub API 找最新含预发布 → 拉其 latest.json manifest → 验签下载安装）。
* 是否需要"启动时自动检查"开关 —— 倾向不加（保持现状：挂载时自动 check 一次）。

## Decision (ADR-lite)

**Context**: 手动按钮已存在但视觉太弱被误认成标题；prerelease 全自动安装受 Tauri updater 静态 endpoint 限制。
**Decision**:
1. 手动检查按钮改为高亮主按钮样式（明显可点），保留状态文案与版本号展示。
2. settings 新增 `prereleaseUpdates: bool`（默认 false）+ 设置面板 Switch。
3. prerelease 全自动安装走 **Rust 侧自定义命令**：查 GitHub Releases API 取最新（含 prerelease，drafts 因无鉴权天然不出现）→ 用该 release 的 `latest.json`（`releases/download/<tag>/latest.json`）作为 endpoint，`updater_builder().endpoints([url])` 运行时构建 → 验签（复用 config pubkey）+ 下载 + 安装。stable（开关关）仍走现有 JS `check()`。
**Consequences**: prerelease 路径较复杂，新增 Rust 命令 + GitHub API 依赖；需 research 确认 tauri-plugin-updater 2.x 的 Rust runtime endpoint API 与 manifest URL 形态。

## Requirements

* 手动"检查更新"改为高亮主按钮样式，明显可点；保留 busy/error/available/upToDate 状态文案 + 版本号。
* settings 新增 `prereleaseUpdates`（默认 false）：TS 类型 + DEFAULT_SETTINGS + normalizeSettings 透传 + Rust struct（serde camelCase, default）+ 测试同步。
* 设置面板"外观/更新"区加 Pre-release Switch（写 draft，保存才持久化）。
* 开关关：维持现有 JS updater `check()`（stable）。
* 开关开：Rust 自定义命令查最新含 prerelease 的 release，验签下载安装。
* prerelease 检查失败需降级为可见 error，不崩溃。

## Out of Scope

* "启动时自动检查"开关（保持挂载自动 check 一次）。
* 修复 draft release（运维，另行 publish）——但需提醒：未 publish 前 stable 通道仍报错。
* 双 latest.json CI 方案（不采用）。

## Research References

* （待补）`research/tauri2-runtime-updater-prerelease.md`

## Technical Notes

* 关键文件：`src/components/SettingsPanel.tsx`、`src/hooks/useUpdateCheck.ts`、`src/hooks/useSettings.ts`、`src/lib/settings.ts`、`src-tauri/src/settings.rs`、`src-tauri/tauri.conf.json`、`.github/workflows/release.yml`。
