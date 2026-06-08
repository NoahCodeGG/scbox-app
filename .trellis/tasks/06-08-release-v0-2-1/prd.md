# 发布 v0.2.1

## Goal

bump 0.2.0 → 0.2.1，打 tag v0.2.1，push 触发 CI 构建签名草稿 release。原因：toast 更新提醒功能（commit 96f653b）在 v0.2.0 tag 之后才提交，不在已构建的 v0.2.0 草稿里，需新版纳入。

## What I already know

* v0.2.0 tag 已 push，CI 已 success（草稿 release 已构建，但**不含** 96f653b 的 toast 功能）。
* 当前工作区干净，三处版本号均 0.2.0（package.json / Cargo.toml / Cargo.lock）。HEAD = 96f653b。
* 版本源两处需改：`package.json:4`、`src-tauri/Cargo.toml:3`（Cargo.lock 随更新）。tauri.conf.json 引用 package.json，无需改。
* 发布机制：push `v*` tag → CI(Win+Mac) 测试+构建签名+latest.json → 草稿 release → 用户手动 publish。

## v0.2.1 较 v0.2.0 的增量

* feat: 发现新版本时弹 toast 提醒并支持一键更新（96f653b）

## Decision (ADR-lite)

**Context**: toast 功能漏在 v0.2.0 tag 之后，需重新发版纳入。
**Decision**: bump patch 到 0.2.1（不重打 v0.2.0 tag，避免历史重写）。本地 bump+commit 由 AI 执行；**push tag 触发对外 CI 前需用户确认**；publish 草稿用户手动。
**Consequences**: 出现 v0.2.0（草稿，可弃）+ v0.2.1（含全部功能）。用户 publish v0.2.1 即可，v0.2.0 草稿可删。

## Requirements

* package.json + Cargo.toml 版本 0.2.0 → 0.2.1；更新 Cargo.lock。
* 本地测试门禁通过（pnpm test / cargo test / tsc）。
* commit（chore: release v0.2.1）+ annotated tag v0.2.1。
* push（main + tag）**前用户确认**。

## Acceptance Criteria

* [ ] 三处版本号 = 0.2.1。
* [ ] 测试全绿。
* [ ] commit + tag 本地创建。
* [ ] push 经确认后执行，CI 触发。
* [ ] 用户 publish v0.2.1 草稿（任务外提醒），可删 v0.2.0 草稿。

## Out of Scope

* publish 草稿（用户手动）。
* 删除 v0.2.0 草稿/tag（用户决定）。

## Technical Notes

* tag `v0.2.1`（CI 匹配 v*）。push 是对外动作，需确认。
