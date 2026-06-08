# 接入 Sonner toast，统一交互提示

## Goal

引入 Sonner toast 组件，把目前散落的内联 status banner 反馈统一成 toast，给保存/删除/复制/检查更新等交互提供一致、非阻塞的成功/失败提示。

## What I already know

* **Sonner 未安装**（package.json 无依赖），无任何 toast/Toaster 使用。
* 现有反馈是**内联 status banner**：
  * `BuildEditor.tsx`：`Status` 状态（`kind: success|error`），覆盖 复制到剪贴板(L236)、保存(L316)、保存失败(L318)、复制为我的流程(L342)、复制失败(L344)、删除(L361)、删除失败(L363)、校验错误(L303/331)。底部渲染 banner（约 L620）。
  * `SettingsPanel.tsx`：检查更新状态文案 `statusText`（busy/error/available/upToDate）；保存设置无显式反馈。
* **入口**：`src/main.tsx` 按窗口 label 渲染 `<App/>`(overlay) 或 `<MainWindow/>`(其它)。Toaster 需挂在主窗口树内（编辑器/设置都在 MainWindow 路由下）。overlay 是穿透常驻窗，通常不需要 toast。
* **主题**：`.dark` 类挂在 `<html>`（`useApplyTheme`）。Sonner 的 `<Toaster theme=.../>` 需与之同步，或用 `theme="system"` + richColors 暗色适配。shadcn 风格（components.json: base-nova, lucide），可用 shadcn 的 sonner 封装约定 `@/components/ui/sonner`。

## Decision (ADR-lite)

**Context**: 交互反馈散落为内联 banner，缺乏统一非阻塞提示。
**Decision**:
1. 安装 `sonner` + shadcn 风格 `@/components/ui/sonner.tsx`（Toaster 跟随主题）。
2. Toaster **仅挂在 MainWindow**（仪表盘/编辑器/设置）；overlay 穿透常驻窗不挂，避免遮挡游戏。
3. BuildEditor 的一次性结果（保存/删除/复制/复制为我的流程/校验错误）改 toast，移除内联 status banner。
4. SettingsPanel：保存设置成功给 toast；**"检查更新"的持续状态（检查中/已是最新/有新版本/失败）保留现有内联文案**（持续态不适合一次性 toast）。
**Consequences**: 反馈统一为 toast；检查更新保持内联是刻意例外。overlay 暂无 toast（交互少）。

## Requirements

* 安装 `sonner` 依赖；新增 `src/components/ui/sonner.tsx`（shadcn 封装，Toaster theme 跟随当前主题——读 `.dark` 或传入 theme 设置）。
* `MainWindow` 树内挂载 `<Toaster/>`（一次，覆盖其下所有路由页）；overlay/App 不挂。
* `BuildEditor.tsx`：移除 `Status` state + 底部 banner，改用 `toast.success`/`toast.error` 覆盖：复制到剪贴板、保存、保存失败、复制为我的流程、复制失败、删除、删除失败、校验错误。
* `SettingsPanel.tsx`：保存设置成功 → `toast.success("已保存设置")`（或类似）；检查更新内联文案不动。
* 暗色/浅色下 toast 配色正确。

## Acceptance Criteria

* [ ] `sonner` 在 package.json；`ui/sonner.tsx` 存在且跟随主题。
* [ ] MainWindow 挂载 Toaster；overlay 不挂。
* [ ] BuildEditor 全部一次性反馈走 toast，内联 banner 已移除（无残留 `status.kind` 渲染）。
* [ ] SettingsPanel 保存成功有 toast；检查更新内联状态仍在。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过（受影响测试同步更新）。
* [ ] dev 下暗色实测 toast 可见、配色正确。

## Out of Scope

* overlay 窗的 toast。
* "检查更新"持续状态转 toast（刻意保留内联）。

## Technical Notes

* 关键文件：`src/main.tsx`、`src/components/MainWindow.tsx`、`src/components/BuildEditor.tsx`、`src/components/SettingsPanel.tsx`、新增 `src/components/ui/sonner.tsx`。
* 主题同步：`useApplyTheme` 用 `.dark` 类；Sonner Toaster 需读同一来源（可传当前 theme 设置）。
