# SCBox 关联链接 + 版本号单点化

## Goal

1. SCBox 无官网，把 README 致谢里指向 `sc2box.com` 的链接改为 B 站参考视频。
2. 版本号单点化：`src-tauri/tauri.conf.json` 的 `version` 改为读取 `../package.json`，今后只维护 package.json 的版本。

## Decisions (locked)

- **D1 链接**：README:228 `[SCBox 手机应用](https://www.sc2box.com/)` → 链接地址改为 `https://www.bilibili.com/video/BV1564y1o7WE/`（去掉 spm_id_from / vd_source 等跟踪参数）。文案「SCBox 手机应用」可保留或微调为「SCBox（参考视频）」。
- **D2 版本单点**：`tauri.conf.json` `"version": "0.1.0"` → `"version": "../package.json"`（Tauri v2 支持 version 指向 package.json 路径）。`package.json` 版本(0.1.0)成为唯一来源，不在本任务 bump。`Cargo.toml` 版本独立、保持不动。

## Requirements

- 改 README.md 第 ~228 行致谢链接 URL（仅 URL，必要时文案微调）。
- 改 src-tauri/tauri.conf.json 顶层 `version` → `"../package.json"`。
- 不 bump 版本号（仍 0.1.0）；不动 Cargo.toml；不动 release/ci workflow。

## Acceptance Criteria

- [ ] README 致谢链接指向 `https://www.bilibili.com/video/BV1564y1o7WE/`，无跟踪参数；无 `sc2box.com` 残留。
- [ ] tauri.conf.json `version` 为 `"../package.json"`，JSON 合法。
- [ ] package.json 版本仍 0.1.0；Cargo.toml 未改。
- [ ] 不破坏构建（version 路径为 Tauri v2 合法用法）。

## Out of Scope

- 版本 bump 到 0.2.0（后续单独）。
- 其它链接/文档。

## Technical Notes

- tauri.conf.json 在 src-tauri/，package.json 在仓库根 → 相对路径 `../package.json`。
- 干净视频链接：去掉 `?spm_id_from=...&vd_source=...`。
