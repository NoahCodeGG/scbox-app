# Overlay 编辑跳转 + 关闭按钮 + 标题显示流程名

## Goal

修复/补全 overlay（悬浮窗）三处交互：
1. **编辑按钮跳转**：点 overlay 编辑按钮应打开主窗口并定位到**当前流程**的编辑页（现在只 show 主窗口、落在仪表盘，不切 /editor、不选中当前 build）。
2. **关闭按钮**：overlay 标题栏加一个关闭按钮，直接隐藏 overlay 自身，无需去主窗口操作。
3. **标题显示流程名**：overlay 顶部补显当前流程名（`activeBuild.name`，已可得但未渲染）。

## What I already know（来自调查）

* **编辑按钮**：`App.tsx:422-434`，onClick 仅 `invoke("open_main")`；`open_main`（`lib.rs:163-174`）只 show+focus 主窗口，不带路由/流程信息。主窗口落在 Dashboard `/`，不切 `/editor`。
* **BuildEditor 选中**：本地 state `selectedFilename`（BuildEditor.tsx:167），靠点击列表 `selectBuild(filename, build)` 切换；**无 mount 时按外部 filename 定位的入口**，需新增。
* **当前 build filename 来源**：覆盖态 = `settings.activeBuildOverride`；自动态需 `stored.find(s => s.build === activeBuild)?.filename` 反查（同 Dashboard.tsx:232）。`activeBuild`（App.tsx:372）。
* **关闭/隐藏**：`hide_overlay`（lib.rs:152-159）只 `window.hide()`，任何窗口可调；overlay 当前无自我关闭 UI。能力无需改（自定义命令走 core:default）。主窗口 Dashboard `overlayShown` state 不会自动同步——hide 后宜 emit 让其更新。
* **标题**：App.tsx:403-411 显示拖拽图标 + MatchupLabel + raceLabel，未显示 `activeBuild.name`（已可得）。
* **窗口间通信**：`src/lib/events.ts` 仅 `BUILDS_CHANGED_EVENT` / `SETTINGS_CHANGED_EVENT`。overlay 已 listen 两者（App.tsx:343-359）。无专门 selected-build 事件。

## Decision (ADR-lite)

**Context**: overlay 编辑跳转不工作、无自我关闭、标题缺流程名；窗口间已有 emit/listen 机制。
**Decision**:
1. **编辑跳转用 emit 导航事件**：overlay 点编辑 → `invoke("open_main")`（show 主窗）+ `emit` 一个新事件（如 `NAVIGATE_EDITOR_EVENT = "navigate://editor"`，payload `{ filename }`）。MainWindow listen 后 `useNavigate("/editor")`；BuildEditor 新增"按 filename 初始定位"入口（listen 同一事件或经 props/context 传入 filename 后 selectBuild）。自动态 filename 由 App 反查 `stored.find(s => s.build === activeBuild)?.filename`。
2. **关闭按钮**：overlay 标题栏加关闭按钮 → `invoke("hide_overlay")` 隐藏自身，并 `emit` 一个新事件（如 `OVERLAY_VISIBILITY_EVENT = "overlay://visibility"` payload `{ shown: false }`）。
3. **关闭后同步主窗**：Dashboard listen 该可见性事件，把 `overlayShown` 置 false，按钮文案同步为"启动悬浮窗"。
4. **标题显示流程名**：App 标题栏渲染 `activeBuild.name`。

**Consequences**: 复用现有事件机制，新增 2 个事件名；BuildEditor 需新增外部定位入口（之前无）。能力无需改。

## Requirements

* 新增事件常量到 `src/lib/events.ts`：导航编辑事件（带 filename）、overlay 可见性事件（带 shown）。
* `App.tsx` 编辑按钮：`invoke("open_main")` + emit 导航事件，payload 含当前 build 的 filename（覆盖态用 `settings.activeBuildOverride`；自动态反查）。
* `MainWindow.tsx`：listen 导航事件 → `useNavigate("/editor")`；把 filename 传给 BuildEditor 定位（经事件/props/状态，择最小侵入）。
* `BuildEditor.tsx`：新增"按 filename 初始/外部选中"入口，收到 filename 时 `selectBuild` 对应 build。
* `App.tsx`：标题栏加关闭按钮 → `invoke("hide_overlay")` + emit 可见性事件 `{shown:false}`。
* `Dashboard.tsx`：listen 可见性事件，同步 `overlayShown`。
* `App.tsx`：标题栏显示 `activeBuild.name`。

## Acceptance Criteria

* [ ] overlay 点编辑 → 主窗口显示并切到 /editor 且选中当前流程（覆盖态与自动态都对）。
* [ ] overlay 关闭按钮可隐藏 overlay；Dashboard 按钮同步为"启动悬浮窗"。
* [ ] overlay 标题显示当前流程名。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过（受影响测试同步）。
* [ ] dev 实测三项交互正常。

## Out of Scope

* 其它 overlay 功能改动。
* overlay 编辑跳转的多 build 批量定位等扩展。

## Technical Notes

* 要动：`src/App.tsx`、`src-tauri/src/lib.rs`、`src/lib/events.ts`、`src/components/MainWindow.tsx`、`src/components/BuildEditor.tsx`。
* BuildEditor 需新增"按 filename 初始选中"入口。
