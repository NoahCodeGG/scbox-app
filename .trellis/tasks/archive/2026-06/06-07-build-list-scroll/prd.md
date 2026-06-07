# 流程列表滚动容器

## Goal

流程数量增多（52+ 内置默认）后，编辑器侧边栏与 Dashboard 的流程列表会把页面撑得很长、交互差。给两处列表加滚动容器（`max-height` + `overflow-y-auto`），超出内部滚动。

## Decisions (locked)

- **D1 范围**：两处都改——编辑器侧边栏流程列表 + Dashboard 流程选择列表。
- **D2 方式**：纯样式/布局，给列表容器设 `max-height` + `overflow-y-auto`；不改数据/逻辑。
- **D3 搜索过滤**：本次不做（流程多时按名称过滤更实用，留作后续单独任务）。

## Requirements

- `BuildEditor.tsx` 侧边栏：流程 `<ul>`（第~435行，`stored.map`）可独立滚动；上方「新建」按钮保持固定可见（滚动只作用于列表，不连同按钮）。高度贴视口（如 `max-h-[calc(100vh-…)]` 或合理上限）。
- `Dashboard.tsx` 流程选择列表（第~263行 `flex flex-col gap-2` + `stored.map`）：给合理 `max-height`（如 `max-h-80`）+ `overflow-y-auto`，卡片不被撑长。
- 列表为空 / 少量时不出现多余空白或滚动条（max-height 不强制撑高）。

## Acceptance Criteria

- [ ] 编辑器侧边栏：流程多时列表内部滚动，「新建」按钮始终可见。
- [ ] Dashboard：流程列表超过上限时内部滚动，卡片高度受控。
- [ ] 少量流程时无多余空白、无空滚动条。
- [ ] 仅样式改动，typecheck/测试不回归。

## Definition of Done

- tsc / vitest 绿。
- 主要在样式层；无逻辑/数据改动。

## Out of Scope

- 按名称搜索/过滤列表（后续）。
- 虚拟滚动等性能优化（52 项无需）。

## Technical Notes

- 编辑器侧栏是 grid 列；滚动应作用于流程 `<ul>` 本身，避免把「新建」按钮也滚走。
- Dashboard 列表在 Card 内，给容器 `max-h-* overflow-y-auto`。
