# 修复：clock=0 时步骤预览跳过首步

## Goal

刚开应用/未连接（clock=0）时，Dashboard「步骤预览」从 `0:11` 而非 `0:00` 开始，因为判定「已播」用 `clock >= time - leadTimeSec`，对 time<leadTimeSec 的步骤在 clock=0 时误判为已播。修复为：clock<=0（对局未开始）时不标记任何步骤为已播，预览从首步开始；对局进行（clock>0）行为不变。

## Decisions (locked)

- **D1**：抽纯函数 `previewSpokenSet(order, clock)` 到 `src/lib/schedule.ts`：`clock <= 0` → 空集；否则复用 `initialSpokenSet(order, clock)`。
- **D2**：`Dashboard.tsx` 的 `PreviewSteps` 用 `previewSpokenSet` 替换内联的 spoken 计算（去重）。

## Requirements

- `schedule.ts` 新增并导出 `previewSpokenSet`；JSDoc 说明 clock<=0 短路。
- `schedule.test.ts` 新增用例：clock=0 → 空集（首步可见）；clock>0 → 与 initialSpokenSet 一致（含 time<lead 的步骤在 clock>0 时被标记）。
- `Dashboard.tsx` `PreviewSteps` 改用该函数；其余渲染不变。

## Acceptance Criteria

- [ ] 未连接/clock=0 时预览从 `0:00`（首步）开始。
- [ ] 对局中（clock>0）预览仍正确跳过已过步骤、行为不回归。
- [ ] schedule 新增用例 + 既有测试通过；tsc 绿。
- [ ] 仅前端；无契约/调度行为对 live 的改变（除 clock<=0 这一边界）。

## Definition of Done

- vitest + tsc 绿。

## Out of Scope

- overlay 的调度逻辑（其 `initialSpokenSet` 只在真正 live 时调用，不受影响）。
- 预览展开全部步骤（另议）。

## Technical Notes

- 现状 `PreviewSteps` 内联：`for i: if clock >= step.time - leadTimeSec: spoken.add(i)`，等价 `initialSpokenSet`。
- `triggerTime = time - leadTimeSec`；leadTimeSec 默认 4，故 time=0 步在 clock=0 时 `0 >= -4` 命中 → 被跳过，即 bug。
