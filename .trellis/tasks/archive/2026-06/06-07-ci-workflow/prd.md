# 把 build-windows.yml 轻量化为通用 CI

## Goal

`build-windows.yml` 当前是「push main / 手动」触发的 Windows 安装包测试构建（跑测试 + tauri build + 上传 artifact）。改造成一个**通用 CI 把关**：保留测试 + 构建（验证打包链路），**新增 PR 触发**，**去掉 artifact 上传**（CI 不需要产物）。`release.yml`（tag 触发的正式发版）不动。

## Decisions (locked)

- **D1**：保留 `pnpm test` + `cargo test` + `tauri build`（构建验证打包链路不坏）。
- **D2**：触发改为 `push: main` + `pull_request: main` + `workflow_dispatch`。
- **D3**：移除 `upload-artifact` 步骤（及对应 `if-no-files-found`/path）。
- **D4**：重命名为通用 CI——文件 `build-windows.yml` → `ci.yml`，`name:` 改为 `CI`，更新顶部注释说明用途。
- **D5**：仍在 `windows-latest` 单平台跑即可（编译/测试门禁一平台足够；多平台留给 release.yml）。

## Requirements

- `git mv .github/workflows/build-windows.yml .github/workflows/ci.yml`。
- `on:` 增加 `pull_request: branches: [main]`，保留 `push: branches: [main]` 与 `workflow_dispatch`。
- 删除最后的 `Upload Windows installers`（upload-artifact）step。
- `name: CI`；更新文件头注释（去掉「上传 artifact」描述，说明这是 push/PR 的 CI 门禁，发版见 release.yml）。
- 其余 step（checkout/pnpm/node/rust/cache/install/前端测试/Rust 测试/tauri build）保持。
- 不改 `release.yml`。

## Acceptance Criteria

- [ ] `ci.yml` 为有效 YAML；触发含 push(main)/PR(main)/手动。
- [ ] 无 artifact 上传 step；保留测试 + tauri build。
- [ ] `name: CI`，注释更新；`build-windows.yml` 不再存在（已 mv）。
- [ ] `release.yml` 未改动。

## Definition of Done

- YAML 校验通过；diff 仅限该 workflow 文件的重命名+编辑。

## Out of Scope

- release.yml；签名/公证；多平台 CI。

## Technical Notes

- 现状触发：`workflow_dispatch` + `push: branches: [main]`；最后一步 `actions/upload-artifact@v4` 上传 `*.msi`/`*.exe`。
