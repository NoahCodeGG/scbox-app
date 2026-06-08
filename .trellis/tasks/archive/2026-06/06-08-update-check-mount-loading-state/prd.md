# 进入设置页自动检查更新时显示加载状态

## Goal

进入设置页时会自动执行一次更新检查（useUpdateCheck mount 的 useEffect），但该路径不设 busy 状态，导致没有"检查中…"文案、按钮也无 loading 动效——与手动点「检查更新」的交互不一致。让自动检查也复用同样的加载反馈。

## What I already know

* `src/hooks/useUpdateCheck.ts`：
  * 手动 `runCheck`（L52-90）有 `setBusy(true)` → 检查 → `finally setBusy(false)`，所以 SettingsPanel 能显示加载态。
  * **mount 的 useEffect（L132-151）**直接 `await check()`，**不调用 setBusy**，也不设 upToDate 前的 busy；所以自动检查期间 UI 无任何"进行中"反馈。
* `SettingsPanel.tsx`：`updateStatusText`（约 L48-60）busy → "检查中…"；检查更新按钮带 RefreshCw 图标，busy 时旋转 + disabled（前序任务已实现，依赖 `updateBusy`/`statusText`）。所以只要 mount 检查正确驱动 busy，文案与按钮动效会自动生效。

## Decision (ADR-lite)

**Context**: mount 自动检查不设 busy，交互与手动检查不一致。
**Decision**: mount 的 useEffect 检查包裹 busy：开始 `setBusy(true)`、结束 `finally setBusy(false)`（保持 cancelled 守卫，避免卸载后 setState）。复用现有 busy 状态，SettingsPanel 文案/按钮动效自动一致。mount 仅探测不安装的语义不变（仍用 `check()`，不触发安装）。
**Consequences**: 进入设置页即显示"检查中…"+ 按钮 loading，与手动一致；无新状态字段。

## Requirements

* `useUpdateCheck.ts` mount useEffect：检查期间 `busy=true`，结束（成功/失败/无更新）`busy=false`，受 cancelled 守卫保护（卸载后不 setState）。
* 不改变 mount 仅探测不自动安装的语义。
* 手动 runCheck/install 行为不变。

## Acceptance Criteria

* [ ] 进入设置页时显示"检查中…"文案，按钮呈 loading（RefreshCw 旋转）且 disabled。
* [ ] 检查完成后状态正确切到 已是最新/有新版本/检查失败。
* [ ] 卸载（快速离开设置页）不触发 setState 警告。
* [ ] `npx tsc --noEmit` 通过；`npx vitest run` 通过（useUpdateCheck.test 同步更新）。

## Out of Scope

* 手动检查/安装逻辑改动。
* prerelease 路径逻辑改动（其 mount 仍走 stable check，不变）。

## Technical Notes

* 仅改 `src/hooks/useUpdateCheck.ts` mount useEffect；测试 `src/hooks/useUpdateCheck.test.ts` 同步。
