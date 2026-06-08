# 修复 CardHeader 标题行按钮换行到下方

## Goal

仪表盘「连接状态」的「诊断/如何启用」与「流程·自动匹配」的「恢复自动」按钮，本应与标题同行靠右，却显示在标题下方左侧。让它们回到标题同行最右侧。

## What I already know（含根因）

* 两处 CardHeader 已写 `className="flex-row items-center justify-between"`（Dashboard.tsx:75、281）意图横向两端对齐。
* **根因**：`CardHeader`（`src/components/ui/card.tsx:28`）默认是 `grid auto-rows-min items-start gap-1`。调用处加的 `flex-row` 在 `grid` 容器里是 no-op（没有 `flex` 类覆盖 `grid`），于是标题与按钮按 grid 行排成上下两行、左对齐。
* 修复：调用处 className 加 `flex`（覆盖默认 `grid`），使 `flex-row items-center justify-between` 生效。

## Decision (ADR-lite)

**Context**: CardHeader 默认 grid，调用处 flex-row 未生效导致换行。
**Decision**: 在两处 CardHeader className 前加 `flex`，覆盖默认 grid 布局，让标题左、按钮右同行。仅改 Dashboard.tsx 调用处，不动 card.tsx 默认（避免影响其它卡片）。
**Consequences**: 两按钮回到标题同行右侧；其它卡片不受影响。

## Requirements

* `Dashboard.tsx` 连接状态卡片 CardHeader（L75）className 加 `flex`，按钮「诊断/如何启用」回到标题同行右侧。
* 流程卡片 CardHeader（L281）className 加 `flex`，按钮「恢复自动」回到标题同行右侧。

## Acceptance Criteria

* [ ] 「诊断/如何启用」与标题「连接状态」同行、靠最右。
* [ ] 「恢复自动」与标题「流程·自动匹配」（含 Info 图标）同行、靠最右。
* [ ] 其它卡片（当前对局/步骤预览）布局不受影响。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过。
* [ ] dev 实测两按钮同行右对齐。

## Out of Scope

* 修改 card.tsx 的 CardHeader 默认样式。
* 其它布局重排。

## Technical Notes

* 仅改 `src/components/Dashboard.tsx` 两处 CardHeader className。
