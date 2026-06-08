# 文案与语音播报分离

## Goal

当前每个 build step 只有一个 `say` 字段，既用于 UI 显示也用于 TTS 播报。缩写写法（如 `火车 x2`、`星轨.双倍挂件`）适合屏幕显示但不适合朗读——TTS 会把 `x2` 读成英文、把 `.` 朗读得很生硬。目标是让屏幕显示与语音播报可以使用不同文案：显示 `火车 x2`，播报 `造两辆火车`。

## What I already know

* 数据结构：`BuildStep { time, say }`，TS 定义 `src/types/build.ts:8-10`，Rust 镜像 `src-tauri/src/builds.rs:36-41`。无独立播报字段。
* 播报链路：`useBuildOrderVoice.ts:120` 到点直接 `speak(step.say, voiceRate)`，无任何文案转换。
* 存储：每个 build 一个 JSON 文件，内置默认在 `src/data/builds/`（`include_dir!` 编译进二进制），用户文件在 OS app-data `builds/` 目录可编辑。
* 文案样例：`{ "time": 166, "say": "火车 x2" }`、`{ "time": 91, "say": "星轨.双倍挂件" }`。

## Decision (ADR-lite)

**Context**: `say` 同时用于显示和播报，缩写写法（`x2`、`.`）不适合 TTS 朗读。
**Decision**: 混合方案。BuildStep 新增可选字段 `sayAs`。播报取值优先级 `sayAs`（非空）→ `humanize(say)` → `say`。`humanize` 做轻量转换：`xN` → `N个`、`.` → 停顿，其余原样。
**Consequences**: 作者可逐句精确控制播报（填 sayAs），不填时由 humanize 兜底，现有文件零改动即可改善朗读。代价：humanize 不做精确量词（辆/只），需要精确量词的句子靠 sayAs 覆盖。

## Requirements

* BuildStep 新增可选 `sayAs` 字段（TS + Rust 同步，serde 用 Option / 默认空）。
* 播报取值：`sayAs` 非空 → 朗读 sayAs（逐字，不经 humanize）；否则朗读 `humanize(say)`。
* `humanize(text)`：`xN`（N 为数字）→ `N个`；`.` → 空格（停顿）；其余字符原样。
* UI 显示始终用原 `say`，不受 sayAs/humanize 影响。
* 向后兼容：现有仅含 `say` 的文件无需改动，自动走 humanize。
* 命名：用 `sayAs`（非 `voice`）避免与 TTS 发音人选择（`speech.ts` list_voices / voiceRate）概念混淆；`say` 显示、`sayAs` 朗读，配对清晰（类似 SSML say-as）。
* 流程编辑器（BuildEditor）支持编辑 `sayAs`：每步可填可选朗读文案，表单 save / JSON 面板双向同步不丢失。

## Acceptance Criteria

* [ ] BuildStep（TS `src/types/build.ts` + Rust `src-tauri/src/builds.rs`）支持可选 `sayAs`。
* [ ] `humanize` 有单测：`火车 x2`→`火车 2个`、`注卵.菌毯`→`注卵 菌毯`、`SCV`→`SCV`、`工蜂 x2.女王`→`工蜂 2个 女王`。
* [ ] `useBuildOrderVoice.ts:120` 改为按优先级取播报文案。
* [ ] 配 sayAs 的 step 朗读 sayAs；无 sayAs 的 step 朗读 humanize 结果。
* [ ] 编辑器可编辑 sayAs，form↔JSON 双向同步不丢失。

## Definition of Done

* humanize 单测 + 取值优先级测试
* Lint / typecheck 通过
* 内置 build 文件保持不变（不强加 sayAs 示范）

## Out of Scope (explicit)

* 精确中文量词映射（辆/只/个）——需要时用 sayAs 字段手动写。
* UI 上展示/编辑 sayAs 字段的界面。
* SCV、星轨 等英文/专有名词的发音矫正。

## Technical Notes

* 关键文件：`src/types/build.ts`、`src-tauri/src/builds.rs`、`src/hooks/useBuildOrderVoice.ts:120`、`src/data/builds/*.json`。
* Rust 侧 `#[serde(rename_all="camelCase")]`，新增字段需同时考虑 serde 默认值/Option。
