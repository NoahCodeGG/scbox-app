# Research: Mockups → Current Code Mapping

- **Query**: Map each in-app mockup to existing components/hooks; identify behavior that must be preserved and net-new UI
- **Scope**: internal
- **Date**: 2026-06-07

## Window topology (current)
- `src-tauri/tauri.conf.json` declares **exactly two windows**:
  - `main` — 320×200, `alwaysOnTop:true`, resizable, `visible:false` → the **overlay** (`App.tsx`).
  - `editor` — 900×700, min 600×400 → the **build editor** (`BuildEditor.tsx`).
- `src/main.tsx:7` routes by window label: `label === "editor"` → `<BuildEditor/>`, else `<App/>`.
- **There is NO dashboard window and NO settings window.** Settings is an in-overlay popover (`SettingsPanel`), diagnostics is a modal (`DiagnosticPanel`). `app.security.csp = null`.

## overlay.html → `src/App.tsx` (+ `App.css`)
The real overlay component to port = the mockup's `.overlay` div (not the harness/stage).

| Mockup region | Current code | Behavior to PRESERVE |
|---|---|---|
| `.ov-bar` drag region | `App.tsx:153` `<div className="drag-handle" data-tauri-drag-region />` | `data-tauri-drag-region` MUST remain for window dragging |
| matchup / build name | `App.tsx:267-274` `.active-build` (matchup + raceLabel) | `identifyMatchup` / `selectBuild` selection logic (`App.tsx:140-148`) |
| `.ov-clock` clock | `App.tsx:160-162` `formatGameTime(snapshot.display_time)`; smooth value from `useInterpolatedClock` | interpolated clock drives countdown |
| `.conn` dot + text | `App.tsx:154-159` `.dot dot-on/off` + `statusText(snapshot)` | states derive from `snapshot.connected/in_game/is_replay` |
| reload icon | `App.tsx:172-174` 重载 button → `reload()` (`useBuildOrders`) | build reload |
| settings icon | `App.tsx:186-194` ⚙ toggles `settingsOpen` → renders `SettingsPanel` | settings popover toggle |
| edit (implicit) | `App.tsx:176-185` 编辑 button → `invoke("open_editor")` | opens editor window via Rust command |
| `.ov-steps` 3 steps | `BuildPanel` (`App.tsx:49-101`) via `upcomingStepIndices(build, spoken, 3)` | imminent countdown `Math.ceil(step.time - effectiveLeadTime - currentTime)`; current/upcoming styling |
| `.ov-foot` voice + lead | voice driven by `useBuildOrderVoice`; lead = `settings.leadTimeSecOverride ?? build.leadTimeSec` | voice gate/rate/lead; `.speaking` on announce |
| `state-waiting` banner | `statusText` "已连接 · 等待对局"; `showBuild = in_game && !is_replay` (`App.tsx:149`) | banner replaces steps when not in game |
| `state-paused` | clock freeze handled by `useInterpolatedClock` | frozen clock behavior |
| `passthrough` | `settings.clickThrough` applied by `useWindowControls`; Ctrl+Shift+S toggle | global-shortcut escape + click-through IPC |
| update banner | `App.tsx:197-211` `useUpdateCheck` (`update.available/version/install/busy`) | updater plugin flow — no mockup equiv; keep |
| diagnostic modal | `DiagnosticPanel` + `useConnectionDiagnostic` (30s disconnect) | keep; mockup has no equivalent |
| voice install hint | `App.tsx:240-254` `useVoiceCapability().needsInstallHint` | keep; no mockup equiv |

Hooks wired in `App.tsx` (all behavior must survive re-skin): `useGameSnapshot` (listens `sc2://game`, `refetch`), `useInterpolatedClock`, `useBuildOrders` (`load_build_orders`, `reload`, `BUILDS_CHANGED_EVENT` listener), `useVoiceCapability`, `useSettings` (`load_settings`/`save_settings`), `useWindowControls` (window pos, click-through, global shortcut, `exit_app`), `useConnectionDiagnostic`, `useUpdateCheck`, `useBuildOrderVoice`, `useAppVersion`.

**Overlay re-skin caveats:** the mockup overlay is 328px wide and taller than 200px; the real `main` window is 320×200. Re-skin must fit (or the window size/`tauri.conf.json` may need adjustment — flag). The mockup's 4-state design maps to existing state but the visual treatment (banners, firing animation, theme-dark) is richer than current `App.css`.

## editor.html → `src/components/BuildEditor.tsx` (+ `BuildTransferPanel.tsx`)
| Mockup | Current code | Preserve |
|---|---|---|
| meta-grid (matchup/race/leadTimeSec) | `BuildEditor.tsx:282-329` race+opponent selects, derived matchup, leadTimeSec | matchup is **derived** `${raceNameToLetter(race)}v${opponent}` (`toDraft`), not free text as in mockup |
| step rows | `BuildEditor.tsx:338-385` — has supply input + 估算→ (supply→time) + time + say + delete | `validateBuild`, `supplyToTime`, immutable step updates |
| add step | `addStep` (`:159`) | |
| save / reload | `handleSave` → `invoke("save_build_order")` + `emit(BUILDS_CHANGED_EVENT)`; `reload` | filename via `generateBuildFilename`; emits change event so overlay reloads |
| JSON preview | **NOT present today** (mockup adds live JSON preview pane) | — net-new presentational, derive from form |
| build list sidebar | `BuildEditor.tsx:251-280` `.editor-sidebar` (select/new) | **mockup lacks this** — must keep |
| delete + confirm | `confirmDelete` → `invoke("delete_build_order")` | mockup lacks; keep |
| import/export | `BuildTransferPanel` (export/copy/import via clipboard + `save_build_order`) | mockup lacks; keep |

**Net-new in mockup:** live JSON preview pane with syntax highlighting, "JSON 有效" validity indicator. **Present in code but missing from mockup:** sidebar build list, opponent select, supply→time estimate, delete-confirm, import/export. The re-skin must keep all existing capability while adopting the mockup's two-column layout + JSON preview.

## settings.html → `src/components/SettingsPanel.tsx`
| Mockup field | Current `Settings` field (`useSettings.ts`) | Notes |
|---|---|---|
| Client API 端口 | `clientApiPort` | exists |
| 提前播报时间 | `leadTimeSecOverride` (null = build default) | exists |
| 语音播报 toggle | `voiceEnabled` | exists |
| 语音速度 range | `voiceRate` (0.5–2.0) | exists |
| 穿透模式 toggle | `clickThrough` | exists |
| 窗口位置 x/y + 重置 | `windowX` / `windowY` (`null`=default) | display/reset UI is net-new; values exist |
| 玩家名 (NoahCode) | **NOT in Settings** | NET-NEW field (no backend; identify "me" logic currently in `identifyMatchup`) |
| 置顶显示 toggle | **NOT in Settings** (hardcoded `alwaysOnTop:true` in tauri.conf) | NET-NEW; would need runtime always-on-top control |
| 还原默认 button | not present | net-new (reset to `DEFAULT_SETTINGS`) |
- Current panel also has 检查更新 row + version footer (`useAppVersion`, `useUpdateCheck`) — keep; mockup omits.
- **Decision needed:** settings.html is drawn as a full standalone window with sidebar context (dashboard nav points to it), but today settings is an in-overlay popover. Re-skin must choose: keep popover, or introduce a settings route/window (ties to dashboard decision).

## dashboard.html → NO current code (NET-NEW)
- No window, no route, no component. Data sources exist in hooks (`useGameSnapshot`, `useBuildOrders`, `identifyMatchup/selectBuild`, `useInterpolatedClock`, `useSettings`) but there is no main-window dashboard. "启动悬浮窗" button implies showing the `main` window — currently `main` starts `visible:false` and is shown by Rust logic. Treat as a new feature/window, not a re-skin.

## onboarding.html → NO current code (NET-NEW)
- No first-run flow, no "has onboarded" persisted flag, no connection-detect UI exists. The live-detect step would reuse `useGameSnapshot`/`useConnectionDiagnostic` data. Net-new feature.

## landing / scbox-overview / index → NO app code (marketing, out of scope)

## Data/IPC contract to preserve (Rust commands & events)
- Commands invoked from FE: `load_build_orders`, `save_build_order`, `delete_build_order`, `load_settings`, `save_settings`, `open_editor`, `exit_app`, plus updater/window plugin calls.
- Events: `sc2://game` (snapshot, `useGameSnapshot`), `BUILDS_CHANGED_EVENT` (`src/lib/events.ts`, cross-window build reload).
- Types mirror Rust serde: `GameSnapshot`/`PlayerInfo` (`types/sc2.ts`), `BuildOrder`/`BuildStep`/`StoredBuild`/`LoadResult` (`types/build.ts`), `Settings` (`useSettings.ts`). **Re-skin must not rename these or change field casing.**

## Caveats / Not Found
- Could not enumerate Rust command list from FE alone beyond the `invoke(...)` call sites grepped; the FE contract above is authoritative for the re-skin.
- `useWindowControls.ts` (lines ~20–118) handles window position persistence, click-through, global shortcut, and `exit_app`; behavior verified by call sites in `App.tsx` but not line-by-line in this pass — preserve as-is.
