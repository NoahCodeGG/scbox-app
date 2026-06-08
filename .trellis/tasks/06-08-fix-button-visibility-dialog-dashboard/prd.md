# 修复诊断对话框 + 仪表盘按钮暗色可见性

## Goal

延续设置面板的按钮可见性修复：诊断对话框的「重试连接」「修改端口」、仪表盘的「隐藏悬浮窗」态按钮在暗色下用 `secondary` variant，背景与卡片几乎同色、无边框，看不出可点。统一改为 `outline`（带边框，暗色可辨）。

## What I already know

* `src/components/DiagnosticPanel.tsx:105-112`：「重试连接」「修改端口」`variant="secondary"`；「关闭」是 default 高亮。
* `src/components/Dashboard.tsx:495-502`：启动/隐藏悬浮窗按钮，`overlayShown` 时 `variant="secondary"`（隐藏态）、否则 default（启动态）。截图红框即隐藏态看起来像禁用 checkbox。
* 同类问题已在设置面板用 `secondary/ghost → outline` 修过（outline 有 `border-border`，暗色可辨）。

## Decision (ADR-lite)

**Context**: 同一批暗色 secondary 按钮不可辨问题，延续既有修法。
**Decision**: 诊断对话框「重试连接」「修改端口」`secondary → outline`；仪表盘悬浮窗按钮隐藏态 `secondary → outline`（启动态保持 default 高亮）。关闭按钮保持 default。
**Consequences**: 与设置面板视觉一致；纯样式改动无逻辑变化。

## Requirements

* `DiagnosticPanel.tsx`：「重试连接」「修改端口」`variant="secondary"` → `"outline"`。
* `Dashboard.tsx`：悬浮窗按钮 `variant={overlayShown ? "secondary" : "default"}` → `variant={overlayShown ? "outline" : "default"}`。

## Acceptance Criteria

* [ ] 诊断对话框两个次要按钮为 outline（带边框）。
* [ ] 仪表盘隐藏悬浮窗态为 outline；启动态仍 default 高亮。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过。
* [ ] dev 暗色实测按钮可辨。

## Out of Scope

* 按钮逻辑/文案/图标变化。
* 其它面板的按钮（已在前序任务处理）。

## Technical Notes

* 仅改 `DiagnosticPanel.tsx`、`Dashboard.tsx`。button variant 定义见 `src/components/ui/button.tsx`（outline 有 border-border）。
