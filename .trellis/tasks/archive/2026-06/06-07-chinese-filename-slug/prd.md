# 修复：中文/非 ASCII build 名称的文件名生成

## Goal

`slugify`(`src/lib/buildFilename.ts`) 当前用 `[^a-z0-9]+` 剥掉所有非 ASCII 字符，导致纯中文名（如「两船兵」）被清成空串、回退为 `build.json`，多个中文名互相撞名成 `build-2/-3`，无法正确区分。改为 Unicode-aware slug：保留 CJK 等 Unicode 字母/数字，仅替换空白/标点/路径符为 `-`。

## Requirements

- `slugify` 保留 Unicode 字母/数字（`\p{L}`/`\p{N}`），仅把其余字符（空白、标点、路径符）折叠为 `-`，去首尾 `-`，ASCII 转小写；全空才回退 `build`。
- 例：`两船兵` → `两船兵.json`；`TvZ 两船兵` → `tvz-两船兵.json`；`!!!` → `build.json`。
- 去重逻辑（`-2/-3`、大小写不敏感全集去重）保持不变。
- Rust `sanitize_filename` 已允许 unicode 单段 `.json`，无需改动（确认即可）。

## Acceptance Criteria

- [ ] 纯中文名生成包含中文的唯一文件名，不再回退 `build`。
- [ ] 含中文的多个 build 文件名互不相同。
- [ ] 纯标点/空白名仍回退 `build.json`。
- [ ] 现有 ASCII 行为不回归（`TvP` → `tvp.json`，撞名 `-2`）。
- [ ] buildFilename 测试更新/新增并通过；typecheck 绿。

## Definition of Done

- 单元测试（buildFilename）覆盖中文、混合、纯标点、去重。
- typecheck / vitest 绿。

## Technical Approach

- 单文件改动：`src/lib/buildFilename.ts` 的 `slugify` 正则改为 `/[^\p{L}\p{N}]+/gu`（带 `u` flag）。其余不变。
- 验证 Rust `src-tauri/src/builds.rs::sanitize_filename` 对 unicode 文件名放行（仅拒 `/ \ .. \0`、多段、非 .json）。

## Out of Scope

- 拼音转写。
- 重命名既有 build 时的文件搬迁（仍保持编辑既有 build 文件名稳定）。

## Technical Notes

- 文件名为存储/选择键，name 字段才是展示标识；文件名只需唯一 + 文件系统安全。
- 三大桌面系统均支持 UTF-8/UTF-16 中文文件名。
