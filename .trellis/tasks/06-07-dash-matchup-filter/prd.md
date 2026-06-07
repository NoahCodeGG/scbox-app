# Dashboard 流程列表按当前对阵过滤

## Goal

首页（Dashboard）的流程选择列表职责是「为当前这局选流程」，不需要列全部 52 个。改为：识别到对阵时只显示与当前对阵相关的流程（我方种族 v 对手种族 + `vX` 兜底）；其余情况合理兜底。全量浏览/管理仍在编辑器。

## Decisions (locked)

- **D1**：识别到对阵（in_game 且 ≥2 玩家）→ 列表只显示相关流程：`parseMatchup(b.matchup).mine === myRace` 且 (`opp === oppRace` 或 `opp === "X"`)。
- **D2 空闲态**：未识别到对阵（非对局/<2玩家）→ 显示全部流程（无对阵可过滤；滚动容器兜底）。
- **D3 过滤为空兜底**：识别到对阵但无匹配流程 → 回退显示全部，避免用户无从选择（并可加一行提示）。
- **D4 保留当前选中**：当前激活（手动 override 或自动选中）的流程**始终出现在列表中**，即使不符合过滤条件，避免选中项消失。

## Requirements

- 新增纯函数 `matchupMatches(buildMatchup: string, myRace: RaceLetter, oppRace: RaceLetter): boolean`（`src/lib/matchup.ts`）：基于 `parseMatchup`，mine 命中 myRace 且 opp ∈ {oppRace, "X"}。+ 单测。
- `Dashboard.tsx`：在 `BuildSelectCard` 渲染前按 D1–D4 计算 `visibleStored`，传给列表 map（替换直接用全量 `stored`）。
- 自动选择逻辑（`autoSelectedFilename`/`selectBuild`）不变。
- 保留已加的 `max-h-80 overflow-y-auto` 滚动。

## Acceptance Criteria

- [ ] 对局中：列表只剩当前对阵相关流程（含 vX 兜底）。
- [ ] 空闲/未识别：显示全部（行为同今）。
- [ ] 该对阵无匹配流程：回退显示全部（不空列表）。
- [ ] 手动/自动选中的流程始终可见，即使被过滤。
- [ ] 新增 matchupMatches 单测 + 既有测试不回归；tsc 绿。

## Definition of Done

- vitest（matchupMatches 用例）+ tsc 绿。
- 仅前端；无 Rust/契约改动。

## Out of Scope

- 列表搜索过滤（后续）。
- 改自动选择算法。

## Technical Notes

- `parseMatchup(matchup) → {mine, opp}`（字母）；`identifyMatchup(players) → {meId, myRace, oppRace}`；`detected = in_game ? identifyMatchup : null`（见 `autoSelectedFilename`）。
- 过滤作用于 `StoredBuild[]`：`stored.filter(s => matchupMatches(s.build.matchup, myRace, oppRace) || s.filename === activeFilename)`。
