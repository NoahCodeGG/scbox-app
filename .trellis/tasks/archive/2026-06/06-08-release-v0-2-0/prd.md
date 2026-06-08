# 发布 v0.2.0

## Goal

发布 0.2.0：bump 版本号 → commit → 打 tag v0.2.0 → push 触发 GitHub Actions 构建签名 Win+Mac 草稿 release。

## What I already know

* 当前 0.1.0。版本号有**两处**需改：`package.json:4`、`src-tauri/Cargo.toml:3`。`tauri.conf.json` version 为 `"../package.json"`（引用，无需改）。`Cargo.lock` 会随 Cargo.toml 更新。
* 发布机制（`.github/workflows/release.yml`）：push `v*` tag → CI matrix(Win+Mac) 跑测试 + tauri-action 构建签名 + 生成 latest.json → 上传到**草稿** GitHub Release → 维护者手动 publish 才对外生效。
* v0.1.0 tag 已存在（对应旧的未 publish 草稿）。本次新功能都在 v0.1.0 之后。
* 工作区干净，所有功能已在 main。

## v0.2.0 changelog（v0.1.0..HEAD）

* feat: 分离 build step 显示文案与语音播报（sayAs）
* feat: 高亮检查更新按钮 + Pre-release 全自动更新开关
* feat: 接入 Sonner toast 统一交互提示
* feat: overlay 编辑跳转当前流程 + 关闭按钮 + 标题显示流程名
* fix: 暗色主题原生滚动条跟随主题（color-scheme）
* fix: 设置面板/诊断框/仪表盘按钮暗色可见性与对齐、卡片标题行布局
* fix: 仪表盘流程列表腾出空间
* fix: 进入设置页自动检查更新显示加载状态
* docs: README 移除玩家名配置 + 补充 AI 开发申明

## Decision (ADR-lite)

**Context**: 发新版需 bump 版本 + 打 tag 触发 CI 草稿发布。
**Decision**: 本地可逆步骤（改 package.json + Cargo.toml 版本号、cargo 更新 lock、commit）由 AI 执行；**push tag 触发对外 CI 构建草稿 release 为不可逆/对外动作，执行前必须再次征得用户同意**；最终 publish 草稿由用户在 GitHub 手动完成。
**Consequences**: 0.1.0 旧草稿仍在（用户可自行处理）；0.2.0 走完整签名流程。

## Requirements

* `package.json` version `0.1.0` → `0.2.0`。
* `src-tauri/Cargo.toml` version `0.1.0` → `0.2.0`；更新 `Cargo.lock`（cargo 命令或 cargo check）。
* commit 版本 bump（chore: release v0.2.0 之类）。
* 打 annotated tag `v0.2.0`。
* **push（main + tag）前向用户确认**（触发对外 CI）。

## Acceptance Criteria

* [ ] 两处版本号 = 0.2.0，Cargo.lock 同步。
* [ ] 本地构建/测试通过（pnpm test、cargo test、tsc）。
* [ ] commit + tag 创建（本地）。
* [ ] push 经用户确认后执行；CI 触发。
* [ ] 用户在 GitHub publish 草稿（任务外，提醒）。

## Out of Scope

* publish 草稿（用户手动）。
* 处理 v0.1.0 旧草稿。

## Technical Notes

* tag 命名 `v0.2.0`（CI 匹配 `v*`）。
* push 是触发对外构建的关键动作——必须用户确认。
