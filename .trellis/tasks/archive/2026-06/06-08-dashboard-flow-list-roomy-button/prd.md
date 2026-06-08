# 仪表盘流程列表腾空间 + 恢复自动按钮可见性

## Goal

仪表盘「流程·自动匹配」卡片：① 流程列表可视区被底部常驻说明文字挤得很窄（流程多时只露 2 项就滚动，不美观）；② 「恢复自动」按钮 ghost 样式暗色下不明显。腾出列表空间并让按钮可辨。

## What I already know

* 卡片代码 `src/components/Dashboard.tsx:280-339`。
* 列表区 `flex-1 overflow-y-auto`（L293），底部有常驻说明 `<p class="mt-4 ...">精确匹配优先，vX 作为任意对手的兜底。手动选择会覆盖自动匹配并同步到悬浮窗。</p>`（L335-338），占走列表纵向空间。
* 「恢复自动」按钮 L283-287：`variant="ghost" size="xs"`，仅 override !== null 时显示。
* 卡片与右侧「步骤预览」同行 grid，`h-full min-h-0`。

## Decision (ADR-lite)

**Context**: 常驻说明文字挤压列表；ghost 按钮暗色不可辨。
**Decision**:
1. 移除卡片底部常驻说明 `<p>`，把该说明内容改挂到 CardEyebrow「流程·自动匹配」旁的一个信息图标（lucide `Info`，size 与标题协调）上，用原生 `title` 或现有 tooltip 组件承载（hover 显示原文），不丢信息又腾出列表空间。
2. 「恢复自动」按钮 `variant="ghost"` → `"outline"`（保持 `size="xs"`），暗色带边框可辨。
**Consequences**: 列表可视区变高、更美观；说明文字转为按需查看；与既有按钮 outline 修法一致。

## Requirements

* 移除底部常驻说明 `<p>`（L335-338），列表区获得更多纵向空间。
* 说明原文移到标题旁 Info 图标的 tooltip（title 属性或项目现有 tooltip 组件），hover/聚焦可见。
* 「恢复自动」按钮改 outline variant，保持 size xs 与 onAuto 逻辑。
* 不破坏列表选中/自动标记/滚动行为。

## Acceptance Criteria

* [ ] 底部常驻说明文字移除，列表可视区明显变高。
* [ ] 标题旁有 Info 图标，hover 显示原说明文字。
* [ ] 「恢复自动」按钮为 outline（带边框）。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过。
* [ ] dev 实测列表更宽敞、tooltip 可见、按钮可辨。

## Out of Scope

* 列表项样式重构、卡片整体布局重排。
* 其它卡片。

## Technical Notes

* 仅改 `src/components/Dashboard.tsx`。tooltip 若用现有组件，先查 `src/components/ui/` 有无 tooltip；无则用原生 `title`。Info 图标来自 lucide。
