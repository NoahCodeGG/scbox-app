# 发现新版本时 Toast 提醒 + 立即更新

## Goal

主窗口启动时若检测到新版本，弹一个 Sonner toast 提示「发现新版 vX.Y.Z」并带「立即更新」按钮，点击触发下载安装并重启。当前只有进设置页才看得到文案，用户不进设置完全不知道有更新。

## What I already know

* `useUpdateCheck`（`src/hooks/useUpdateCheck.ts`）mount 时自动 check，暴露 `available/version/install/...`。`install()` 已实现下载安装+relaunch（stable 走 update.downloadAndInstall，prerelease 走 Rust 命令）。
* **现状缺口**：`useUpdateCheck` 仅在 `SettingsPage`（MainWindow.tsx:90-108）调用，而 SettingsPage 只在 `/settings` 路由挂载——所以"启动检测"实际只在用户打开设置页时发生，不进设置就无任何提醒。
* Sonner 已接入（`ui/sonner.tsx` + MainWindow 挂载 Toaster）。`toast` 支持 action 按钮（`toast(msg, { action: { label, onClick } })`）。
* MainWindow 顶层（115+）常驻，有 `settings`（含 prereleaseUpdates）。

## Decision (ADR-lite)

**Context**: 更新检测只在设置页发生，无全局提醒；已具备 toast + install 能力。
**Decision**: 在 MainWindow 顶层（常驻）做一次启动更新检查，检测到 available 时弹 Sonner toast（标题「发现新版 vX.Y.Z」+ action「立即更新」→ 调 install()）。避免与 SettingsPage 的 useUpdateCheck 实例重复弹：toast 只弹一次（用 ref/state 去重）。沿用现有 install 的下载安装+relaunch。
**Consequences**: 启动即提醒，不依赖进设置页；SettingsPage 内联状态保留。需处理两个 useUpdateCheck 实例并存（或把检查上提、SettingsPage 复用）。

## Open Questions

* 实现位置：在 MainWindow 顶层新加一个常驻的检查（独立 useUpdateCheck 实例或抽一个轻量检查 hook 只 detect），还是把更新状态上提到 MainWindow 用 context 共享给 SettingsPage？倾向 MainWindow 顶层加一个常驻实例专门负责"启动检测+toast"，SettingsPage 维持自己的实例（职责分离，改动小；接受两次 check 请求）。
* toast 去重：同一会话只弹一次（避免设置页来回切或重渲染重复弹）。
* prerelease：MainWindow 顶层检查是否也按 settings.prereleaseUpdates？倾向是（与设置一致）。

## Requirements (evolving)

* MainWindow 顶层常驻执行启动更新检查（尊重 prereleaseUpdates）。
* 检测到 available → 弹 Sonner toast：「发现新版本 v{version}」+ action「立即更新」。
* 点「立即更新」→ install()（下载安装+relaunch）；进行中/失败有反馈（toast loading/error 或复用 busy）。
* toast 每会话只弹一次（去重）。
* SettingsPage 内联状态保留不变。

## Out of Scope (evolving)

* 定期轮询。
* 常驻横幅/侧边栏红点。

## Technical Notes

* 关键文件：`src/components/MainWindow.tsx`、`src/hooks/useUpdateCheck.ts`（可能加一个只 detect 的轻量入口或复用）、`sonner` toast action。
* mount 检查的 busy/语义已在 useUpdateCheck，注意 toast 触发时机（available 变 true 时）。
