# README 调整：移除玩家名配置 + 补充 AI 开发申明

## Goal

玩家名配置已从代码移除（`settings.rs` 把 `playerName` 当 legacy 字段忽略），但 README 仍在"配置设置"表格里展示该项，且"敌我识别"小节仍描述"优先匹配玩家名"的旧逻辑。需更正文档使其与代码一致，并新增一段 AI 开发申明。

## What I already know

* `README.md:107` 设置表格有「玩家名」行，需删除。
* `README.md:184-185`「敌我识别」小节描述旧逻辑（优先匹配玩家名 → 回退 user vs computer → 兜底 players[0]）。当前实际逻辑（`src/lib/matchup.ts:79-91`）：第一个 `type:"user"` 玩家为"我"，否则回退第一个玩家。需更正。
* 当前无 AI 开发申明。

## Requirements

* 删除设置表格中的「玩家名」行。
* 更正「敌我识别」小节，去掉玩家名匹配描述，改为反映当前 `identifyMatchup` 逻辑。
* 新增一段「AI 开发申明」：放在顶部简介下方（第 5 行致谢与第 7 行 `---` 之间），用引用块（`>`）呈现，口径为"AI 辅助开发"——大意「本项目在开发过程中大量借助 AI 编程工具辅助实现」，不强调比例、不加免责。

## Decision (ADR-lite)

**Context**: 需在 README 加 AI 开发申明，位置与口径有多选。
**Decision**: 放顶部简介下方（首屏可见），引用块样式；口径中性"AI 辅助开发"，不强调比例、不加免责提示。
**Consequences**: 首屏即透明告知，措辞温和不喧宾夺主。

## Acceptance Criteria

* [ ] 设置表格不再出现「玩家名」。
* [ ] 「敌我识别」描述与 `matchup.ts` 当前逻辑一致。
* [ ] README 含一段 AI 开发申明（位置/措辞见决策）。
* [ ] 全文无残留 `玩家名` / `playerName` 提及。

## Out of Scope

* 代码改动（玩家名已在代码层移除，本任务仅文档）。

## Technical Notes

* 仅改 `README.md`。
