# 批量补充内置默认 build（按截图）

## Goal

把用户提供的 ~52 张 SCBox 截图转成内置默认 build JSON，写入 `src/data/builds/`，随包下发。沿用上一任务的只读默认模型与 `{name, matchup, race, leadTimeSec, steps:[{time,say}]}` 格式。

## Decisions (locked)

- **D1 截断处理**：全部按截图可见内容转录；部分底部被按钮截断的 build 只录到可见处，用户最后统一核对/补全。
- **D2 交付**：按对战分批（TvZ→TvT→TvP→ZvT→ZvZ→ZvP→PvT→PvZ→PvP），每批一个 commit，用户抽查 OK 再继续下一批。
- **D3 格式**：`say` 原样保留截图标签（如 `机枪 x2`、`兵营.气矿`、`SCVx2`）；`time` 由 mm:ss 转秒；`leadTimeSec` 默认 4。
- **D4 标识**：`name` = 截图标题；`matchup`/`race` 由标题前缀或简介推断（TvZ/TvT/TvP/ZvT/ZvZ/ZvP/PvT/PvZ/PvP）。
- **D5 去重**：`TVZ 两船兵` 已作为 `tvz-two-medivac.json` 存在，不重复添加。

## Requirements

- 每个 build 一个 JSON 文件，文件名由 name slug 派生（unicode-aware），不与现有撞名。
- 同一时间的并列步骤各占一条（与 tvz-two-medivac 一致）。
- 不改加载/编辑器代码——纯数据新增。

## Acceptance Criteria

- [ ] 每批 build JSON 落入 `src/data/builds/`，构建后作为只读默认出现。
- [ ] 文件名唯一、unicode 安全。
- [ ] cargo test（embedded_defaults 全部可解析、无 errors）通过。
- [ ] 前端 typecheck/test 不回归。
- [ ] 截断 build 标注在本 PRD 的 Notes 供用户补全。

## Definition of Done

- 所有批次 commit；`cargo test` 的 `embedded_defaults_parse_and_are_read_only` 等通过。
- 用户抽查确认转录质量。

## Out of Scope

- 截断 build 的缺失步骤补全（待用户提供完整截图）。
- 步骤名规范化/纠错（先原样录，后续单独优化）。

## Technical Notes

- 截图来源：`/Users/noahcode/Downloads/Screenshot_2026-06-07-*_com.beitiansoftware.scbox*.jpg`
- 截断疑似：单矿火蟑螂、打地鼠、两矿蟑螂狗、单矿雷神 等（底部按钮处停，未见 出门/进攻 结尾）。
- 批次清单见实现进度。
