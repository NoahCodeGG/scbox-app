# 编辑器步骤时间改用 mm:ss 输入

## Goal

编辑器步骤时间输入从「原始秒数」改为人性化的 `mm:ss`（如 `03:55`），更贴近 SCBox 截图与游戏内时钟。存储与契约不变：磁盘/JSON/Rust 仍存 `time` 为秒数（number）。mm:ss 仅在 UI 层。

## Decisions (locked)

- **D1 范围**：mm:ss 只在编辑器表单输入/显示层；JSON 高级视图与磁盘仍为秒数。不动 TS/Rust 的 `time: number/f64` 契约、不动调度、不动已写的 build JSON。
- **D2 解析兼容**：time 解析同时接受 `mm:ss`（含 `m:ss`）与纯秒数（无冒号）。纯秒数路径保证 JSON 导入（`time:235`）与旧行为不回归。

## Requirements

- 新增 `src/lib/clockTime.ts`：`parseClockTime(str): number | null`（`mm:ss`→秒，校验秒段 0–59；无冒号按纯秒；负/NaN→null）与 `formatClockTime(sec): string`（秒→`M:SS`，秒段零填充）。+ 单测。
- `buildValidation.ts`：步骤 time 用 `parseClockTime`；错误信息提示「格式应为 秒 或 mm:ss」。其余校验不变。
- `BuildEditor.tsx`：`toForm` 把 `step.time`(秒) 格式化为 `mm:ss` 进表单；时间输入框 placeholder 改「时间 mm:ss」、适当加宽；`formToJson` 的 valid 分支仍输出秒（经 `exportBuildJson`）。
- `buildTransfer.ts`/`exportBuildJson`/磁盘：保持秒数，不改。

## Acceptance Criteria

- [ ] 编辑器时间框显示/接受 `mm:ss`（如 `3:55`/`03:55`），保存后 JSON 仍是秒。
- [ ] 纯秒数输入与 JSON 导入（`time` 为数字秒）仍可用。
- [ ] `mm:ss` 秒段 ≥60 或非法格式给出清晰错误。
- [ ] clockTime 单测 + buildValidation 既有/新增用例通过；typecheck 绿。
- [ ] 调度/磁盘/Rust 无改动。

## Definition of Done

- clockTime.test.ts 覆盖 mm:ss、m:ss、纯秒、非法、format 往返。
- vitest / tsc 绿。

## Out of Scope

- 改磁盘/JSON/Rust 的 time 类型。
- Dashboard 步骤展示格式（本次仅编辑器输入；如需统一展示另议）。

## Technical Notes

- 截图时间样式参考 `03:55`（分钟零填充 2 位、秒 2 位）。
- 现有 `buildValidation` 用 `parseNonNegative` 解析 time；改为 `parseClockTime`。
