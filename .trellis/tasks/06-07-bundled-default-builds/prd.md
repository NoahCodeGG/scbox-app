# 只读内置默认流程 + 不覆盖用户流程

## Goal

让仓库可持续维护一组「内置默认 build」并随安装包/自动更新下发，同时用户自建/编辑的 build 永不被更新覆盖。当前 `seed_if_empty` 模型只在 builds 目录为空时种子一次，现有用户收不到后续默认更新。改为「只读内置默认（编译期嵌入）+ 可写用户流程（app-data），加载时合并」。本任务同时落地首批真实默认 TvZ 两船兵 并移除 terran-standard 占位。

## Decisions (locked)

- **D1 内置默认运行时来源**：用 `include_dir` crate 把 `src/data/builds/` 整目录编译进二进制，运行时自动枚举默认 build。无需手动登记，天然只读。
- **D2 冲突规则**：无 override——`generateBuildFilename` 去重涵盖「默认+用户」全集，用户 build 永不与默认撞名。只读默认始终可见（当参考/模板）。迁移由 D4 独立解决，不依赖同名覆盖。
- **D3 编辑器 UX**：默认在列表可见但只读——选中只读默认时隐藏保存/删除，提供「复制为我的流程」生成**新名**可写副本（写入 app-data）；只读默认保留可见。需给 `StoredBuild` 加 `readOnly` 标记（TS+Rust 双端）。
- **D4 迁移**：移除 `seed_if_empty`；加载时按内容指纹清理——app-data 中与「已知种子指纹」（含旧 `terran-standard.json` 字节 + 当前内置默认字节）完全一致的文件视为未改动 pristine 副本，删除让只读默认接管。用户改过的内容不匹配，绝不删。
- **D5 范围**：一起做——写入 TvZ 两船兵 为首批内置默认、移除 terran-standard 占位，前端 `FALLBACK_BUILD` 改指向新默认。
- **D6 build 名称字段**：`BuildOrder` 增加 `name`（人类可读标识，如「TvZ 两船兵」）。编辑器新增名称输入；新建 build 的 filename 由 `name` slug 派生（沿用 `-2/-3` 去重）；编辑既有 build 时 filename 保持稳定（不随改名变动，避免文件搬迁）。Dashboard/编辑器列表展示 `name`。load 容错：缺 `name` 时回退显示 matchup。校验：保存时 `name` 非空。

## Requirements

- 引入 `include_dir`，把 `src/data/builds/` 编译进二进制作为只读默认集。
- `load_build_orders` 新流程：枚举内置默认（readOnly=true）→ pristine 清理 app-data → 读 app-data 用户 build（readOnly=false）→ 合并（默认+用户，文件名全集去重，无 override）。
- 移除 `seed_if_empty` 及其调用；移除 `DEFAULT_BUILD_FILENAME`；`DEFAULT_BUILD_JSON`/前端 fallback 改由新默认提供。
- `StoredBuild` 增加 `readOnly: boolean`（Rust serde camelCase + TS 镜像）。
- pristine 清理：内置「已知种子指纹」常量（至少含旧 terran-standard.json 原文），app-data 文件字节命中即删。
- `BuildOrder` 增加 `name: string`（Rust+TS）；load 容错缺失时回退 matchup。
- 编辑器：新增名称输入；新建 build filename 由 name slug 派生（去重涵盖默认+用户全集）；编辑既有 build filename 保持稳定；保存校验 name 非空。
- 编辑器：只读默认隐藏保存/删除，提供「复制为我的流程」→ 以新名 `save_build_order` 写入 app-data → reload 后选中用户副本。
- Dashboard/编辑器列表展示 `name`（缺失回退 matchup）。
- 数据：删除 `src/data/builds/terran-standard.json`，新增 `src/data/builds/tvz-two-medivac.json`（name「TvZ 两船兵」，TvZ，time+say，47 步，已转录）。
- `FALLBACK_BUILD`(lib/builds.ts) 改 import 新默认文件。

## Acceptance Criteria

- [ ] 内置默认随包下发；改/增默认 build 重新构建即生效，无需用户操作。
- [ ] 用户自建/编辑的 build 更新后保持不变，绝不被覆盖。
- [ ] 默认 build 在编辑器列表可见且标记只读，无法就地保存/删除；「复制为我的流程」生成新名可写副本。
- [ ] 用户 build 文件名永不与默认撞名（去重涵盖全集）。
- [ ] 现有用户的 pristine `terran-standard.json` 被自动清理；用户改动过的同名文件保留。
- [ ] 不再有 `seed_if_empty` 行为（空目录不再写文件）。
- [ ] 编辑器可填写 build 名称；新建时 filename 由名称派生；列表/Dashboard 按名称展示。
- [ ] typecheck / cargo test / 前端测试全绿。

## Definition of Done

- 测试：Rust（合并/去重、pristine 清理删未改/留已改、readOnly 标记、无 seed）；前端（name 校验+派生 filename、编辑器只读交互、复制为我的流程）。
- typecheck / cargo test / vitest 全绿。
- 升级路径验证（pristine 清理）。
- spec 更新：builds 加载模型（`.trellis/spec/tauri/` 相关）。

## Technical Approach

- **Rust** `builds.rs`：`include_dir!("$CARGO_MANIFEST_DIR/../src/data/builds")` 嵌入默认；新加载实现枚举+清理+合并；`StoredBuild { filename, build, read_only }`；`BuildOrder` 加 `name`；`PRISTINE_FINGERPRINTS: &[&str]` 常量。删 `seed_if_empty`/`DEFAULT_BUILD_FILENAME`。`lib.rs` 去掉 seed 调用。
- **TS**：`types/build.ts` `BuildOrder.name` + `StoredBuild.readOnly`；`buildValidation` name 非空校验；`buildFilename` 由 name 派生 + 全集去重；`useBuildOrders` fallback 带 readOnly；`lib/builds.ts` import 新默认；`BuildEditor.tsx` name 输入 + 只读分支 + 复制按钮 + 稳定 filename；`Dashboard.tsx` 展示 name + 只读徽标。
- **数据**：移除 terran-standard.json，新增 tvz-two-medivac.json（含 name）。

## Decision (ADR-lite)

**Context**: seed-once 模型无法在保护用户数据的同时下发演进中的默认 build。
**Decision**: 内置默认改为编译期只读嵌入（include_dir），用户 build 留可写 app-data，加载时合并（用户同名覆盖），并按内容指纹一次性清理历史 pristine 种子。
**Consequences**: 默认随版本自动更新、用户数据零覆盖；代价是默认不可被用户就地改（需复制为副本），且需维护 pristine 指纹常量。

## Out of Scope

- 在线/云端同步默认。
- 默认 build 的版本号或差量更新机制。
- 增量数据（矿/气/耗时）字段。

## Technical Notes

- 相关文件：`src-tauri/src/builds.rs`、`src-tauri/src/lib.rs`、`src/lib/builds.ts`、`src/hooks/useBuildOrders.ts`、`src/types/build.ts`、`src/components/{Dashboard,BuildEditor}.tsx`、`src-tauri/Cargo.toml`。
- 选择/override 以 filename 为键，跨源文件名需唯一。
- TvZ 两船兵 build 已在会话中逐条转录（time+say）。
