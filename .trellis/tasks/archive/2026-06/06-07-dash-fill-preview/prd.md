# Dashboard 卡片撑满高度 + 完整步骤预览

## Goal

1. 首页底部两张卡片（流程列表 / 步骤预览）高度撑满默认窗口（1000×680），默认窗口下页面不出现滚动条；内容多时由卡片内部列表滚动，而非整页滚动或固定 `max-h-80` 提前出条。
2. 右侧「步骤预览」从「仅 4 条接下来」改为**渲染完整流程**，可滚动查看全部步骤，高亮当前/下一步并自动滚动到可视区。

## Decisions (locked)

- **D1 高度**：用 flex 撑满（不靠魔法像素）。Dashboard 根 `flex h-full flex-col`，底部行 `flex-1 min-h-0`，两卡片 `flex flex-col min-h-0`，内部列表 `flex-1 min-h-0 overflow-y-auto`。
- **D2 完整预览**：StepsPreviewCard/PreviewSteps 渲染 `build.steps` 全部，用 `previewSpokenSet` 区分已播/下一步/未来；下一步高亮（同现样式）；列表可滚动；下一步用 ref + `scrollIntoView({block:"nearest"})` 自动滚入可视区（clock 变化时）。

## Requirements

- `Dashboard.tsx`：
  - 根容器 `flex h-full flex-col gap-4`（main 已是定高 grid 单元，`h-full` 可用）。
  - 顶部行（连接/对局）保持自然高度；底部行 `grid gap-4 md:grid-cols-2 flex-1 min-h-0`。
  - `BuildSelectCard`、`StepsPreviewCard` 改为 `flex flex-col min-h-0`（`Card` 加 `h-full min-h-0`），其 `CardContent` `flex-1 min-h-0`，内部滚动列表 `h-full overflow-y-auto pr-1`（移除 `max-h-80`；编辑器侧栏不在本任务）。
  - 空列表/空预览态保留。
- `PreviewSteps`：渲染全部步骤；`spoken = previewSpokenSet(build, clock)`；首个未播为「下一步」高亮；已播置灰；其余正常。给「下一步」行挂 ref，`useEffect([clock])` 里 `scrollIntoView({block:"nearest"})`。
- 不改 Rust/调度/数据契约；不改 overlay。

## Acceptance Criteria

- [ ] 默认 1000×680 窗口：仪表盘页无整页滚动条；底部两卡片高度填满、等高。
- [ ] 流程列表项多时卡片内部滚动；少时不出现多余空白/滚动条。
- [ ] 步骤预览显示完整流程，可滚动；当前/下一步高亮；clock 推进时下一步自动滚入可视区。
- [ ] min 高度 560 下仍可用（卡片变矮、内部滚动）。
- [ ] tsc + vitest 绿；仅前端。

## Definition of Done

- tsc / vitest 绿；人工在默认窗口目测无整页滚动、预览可看全。

## Out of Scope

- 编辑器侧栏列表（已有滚动）。
- 列表搜索过滤。
- 未连接 idle 是否显示全部（另议，本任务不改过滤逻辑）。

## Technical Notes

- `MainWindow` `<main className="overflow-auto p-8 pt-7">` 是定高滚动容器；Dashboard `h-full` 即填满其内容区。其它路由(editor/settings)不受影响（它们非 h-full，main 照常滚动）。
- flex 撑满链路关键：每层 `min-h-0` 否则子项不收缩、仍会溢出。
- `previewSpokenSet` 已存在（clock<=0 短路）。
