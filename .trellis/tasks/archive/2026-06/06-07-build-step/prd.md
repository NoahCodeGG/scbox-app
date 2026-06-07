# 移除 BuildStep 的人口 (supply) 字段

## Goal

删除 build 步骤里的人口数 (`supply`) 字段及其相关 UI/逻辑，`BuildStep` 仅保留 `time`（时间）与 `say`（操作内容）。简化数据模型与编辑器——人口字段当前不参与调度，只用于编辑器的「人口→时间」估算，价值不大。

## Requirements

- `BuildStep` 类型去掉 `supply`，仅 `{ time, say }`。
- 编辑器 (`BuildEditor.tsx`) 移除「人口」输入框与「估算→」按钮；步骤行只剩 时间 / 语音内容 / 删除。
- 删除 `supplyTime.ts`（`supplyToTime` 估算）及其测试。
- `buildValidation.ts`：`DraftStep` 去掉 `supply`，校验逻辑去掉人口解析。
- Rust `builds.rs`：`BuildStep` 结构体去掉 `supply` 字段；更新引用 supply 的测试。
- JSON 双向编辑 (`buildTransfer.ts` / `formToJson`) 不再产出/读取 `supply`。
- 向后兼容：现有带 `supply` 的 JSON 仍能加载（serde 无 `deny_unknown_fields`，TS 校验忽略多余键），保存时自动丢弃该字段。

## Acceptance Criteria

- [ ] `BuildStep`（TS 与 Rust）不含 `supply`。
- [ ] 编辑器不再显示人口输入与估算按钮，步骤增删改正常。
- [ ] 含 `supply` 的旧 JSON 文件加载不报错；保存后文件中不再有 `supply`。
- [ ] `supplyTime.ts` 及其测试已删除，无残留引用。
- [ ] 受影响的测试（buildValidation / builds.rs）更新并通过。
- [ ] typecheck / lint / `cargo test` / 前端测试全绿。

## Definition of Done

- 测试更新并通过（前端 vitest + Rust cargo test）。
- Lint / typecheck / CI green。
- 旧数据加载兼容性已验证。
- Editor 与 JSON 双向编辑一致。

## Technical Approach

- TS：`types/build.ts`、`lib/buildValidation.ts`、`components/BuildEditor.tsx`、`lib/buildTransfer.ts` 去除 supply 相关字段/分支；删除 `lib/supplyTime.ts` + `lib/supplyTime.test.ts`。
- Rust：`src-tauri/src/builds.rs` 删除 `BuildStep.supply` 字段，更新 `save_then_load_round_trips_including_supply` 等测试。
- 兼容性靠 serde 默认忽略未知字段 + TS 校验只读已知字段实现，无需迁移脚本。

## Decision (ADR-lite)

**Context**: 人口字段不参与语音调度，仅作编辑器估算用，且与移动端 SCBox 截图的「增量」展示不一致，维护价值低。
**Decision**: 直接删除 `supply`，步骤只保留 time + say。放弃此前讨论的「增量数据」方案。
**Consequences**: 模型更简单；失去 supply→time 估算辅助（用户改为直接填时间）。旧文件中的 supply 被静默丢弃。

## Out of Scope

- 任何「增量数据」(矿/气/补给/耗时) 字段——本次不做。
- 调度逻辑改动。
- 数据迁移脚本（依赖 serde 忽略未知字段即可）。

## Technical Notes

- `builds.rs:41` 注释明确禁止 `deny_unknown_fields`，保证旧文件兼容。
- TvZ 两船兵 build 的逐条 time+say 已转录（见会话），定稿后可作为新格式样例写入。
