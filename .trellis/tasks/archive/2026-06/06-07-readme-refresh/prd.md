# 精准更新 README 至当前状态

## Goal

README.md 多处已过时，本任务**保留现有结构**、只精准修正与现状不符/缺失的内容。不重排不重写文案风格。

## 现状事实（写入依据）

- 内置默认 build：**52 个**，编译期只读嵌入（`include_dir`，`src/data/builds/*.json`，unicode 名如 `tvz-两船兵.json`），随版本更新下发；用户 build 存 app-data `builds/` 可写。`terran-standard.json` 已不存在。
- 自定义：编辑器选中只读默认 → **「复制为我的流程」**生成可编辑副本；或新建。编辑器是主窗口左侧导航 **「流程」页**（非独立窗口）；导航：仪表盘 / 流程 / 设置。
- build JSON 增加 `name`（人类可读名）；编辑器时间用 **mm:ss** 输入但磁盘仍存秒(number)；无 `supply`。形如 `{ "name","matchup","race","leadTimeSec","steps":[{ "time","say" }] }`。
- Dashboard：流程选择按当前对阵过滤；步骤预览显示完整流程（可滚动）。overlay 仍显示未来 3 步。
- 设置项（settings.rs）：playerName、clientApiPort、leadTimeSecOverride、voiceEnabled、voiceRate、clickThrough、**clickThroughShortcut（可自定义快捷键，默认 Ctrl+Shift+S）**、**theme（light/dark/system）**、windowX/Y、activeBuildOverride。
- 自动更新：tauri-plugin-updater，启动时 + 设置里「检查更新」按钮检查 `releases/latest/download/latest.json`（见 `docs/AUTO_UPDATE.md`）。
- CI/CD：`ci.yml`（push/PR 测试+构建，无 artifact）+ `release.yml`（推 `v*` tag → Win+macOS 构建、minisign 签名、生成 latest.json、传**草稿 Release**，维护者发布）。
- React 18.3.1 + TS + Vite；Tauri 2。

## Requirements（逐节改动）

- **核心特性**：把「运行时可编辑」改为反映「52 个内置只读默认 + 复制/新建可编辑」；新增「自动更新」「按对阵过滤+完整步骤预览」。穿透快捷键描述为「可自定义」。
- **安装**：
  - Windows：正式安装从 **GitHub Releases**（已签名 + 自动更新）下载；开发构建在 CI（`ci.yml`）。修正失效的 `build-windows.yml` 链接。
  - macOS：`release.yml` 现也构建 macOS `.dmg`（**Apple Silicon / 未公证**，首次打开需右键打开或 `xattr -dr com.apple.quarantine`）。保留本地开发命令。
- **准备 Build Order**：删除「编辑 terran-standard.json」；改为「内置默认只读 → 复制为我的流程 / 新建」；用户目录路径保留；示例文件名更新为现有 unicode 命名。JSON 示例加入 `name` 字段；说明编辑器 mm:ss 输入、磁盘存秒。
- **配置设置**：设置表补 **主题（深/浅/跟随系统）**、**穿透快捷键（可自定义，默认 Ctrl+Shift+S）**；入口改为「主窗口左侧导航 → 设置」。新增「检查更新」说明（自动更新）。
- **悬浮窗操作**：穿透解除快捷键说明为「默认 Ctrl+Shift+S，可在设置自定义」。
- **开发 / 技术栈**：CI/CD 改为「ci.yml（push/PR CI）+ release.yml（tag 签名发布 + 自动更新，Win+Mac）」；技术栈加自动更新（tauri-plugin-updater）。项目结构补 `src/data/builds/`（内置默认）说明，编辑器为「流程」页。
- **已知问题**：删除「拖动失效（修复中）」（已修复）；可保留多屏、Windows 语音；可加「macOS 未公证 Gatekeeper 提示」。
- 其余（贡献/License/致谢）基本保留。

## Acceptance Criteria

- [ ] 无残留 `terran-standard.json` / `build-windows.yml` 链接 / 「拖动失效修复中」。
- [ ] 反映 52 内置只读默认 + 复制编辑、name 字段、mm:ss、主题、可自定义穿透快捷键、自动更新、Win+Mac 发布、ci/release 双 workflow。
- [ ] 结构与原 README 一致（仅内容修正），Markdown 合法。

## Out of Scope

- 整体重写/重排；英文版；docs/ 其它文件。

## Technical Notes

- 不改代码，仅 README.md。
- 默认示例文件名可用 `tvz-两船兵.json`。
