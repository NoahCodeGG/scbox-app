# Connection diagnostics (6119 detection + user-friendly troubleshooting)

## Goal

When the SC2 Client API (6119) is unreachable, show a user-friendly diagnostic
panel explaining what's wrong and how to fix it. Reduces the "why isn't it
working?" confusion for new users who haven't enabled the Client API or have
the wrong port.

## Background (verified)
- `useGameSnapshot` polls `http://127.0.0.1:6119/game` every 1s (or the
  configured port).
- `snapshot.connected` is `false` when the HTTP request fails (SC2 not running,
  API not enabled, wrong port, or port occupied).
- Currently the overlay just shows "SC2 未连接" in the status row with no
  further guidance.
- The gear icon + settings panel let users change the port, but don't explain
  *why* to change it or how to enable the API.

## Problem
New users who install the app and open it (without SC2 running or without
`-clientapi 6119` in launch options) see "SC2 未连接" indefinitely and don't
know what to do. There's no in-app guidance on:
- How to enable the Client API (`-clientapi 6119` in launch options)
- Where to add that flag (Battle.net launcher settings)
- Whether SC2 is actually running
- Whether the port is correct (if they changed it in settings)

## Decisions (locked, autonomous)
| Topic | Decision |
|-------|----------|
| Trigger | After **30 seconds** of continuous `snapshot.connected=false` (ignore brief disconnects during SC2 startup/transitions), show a dismissable diagnostic panel overlaying the main UI. |
| Panel content | **Title:** "无法连接到星际争霸 2"<br>**Checklist:** (1) SC2 是否正在运行？(2) 是否启用了 Client API？(3) 启动参数是否包含 `-clientapi <port>`？<br>**How-to:** 在 Battle.net 启动器 → 星际争霸 2 → 选项 → 游戏设置 → 附加命令行参数 → 添加 `-clientapi 6119`<br>**Current port:** 显示当前设置的端口（默认 6119）<br>**Actions:** [重试连接] [修改端口（跳转到设置）] [关闭] |
| Dismissal | User clicks [关闭] or [X] → panel hides; if `connected` becomes `true`, panel auto-hides. User can manually dismiss and re-open via a "诊断" button in the status row (only visible when disconnected). |
| No retry loop | [重试连接] just manually triggers one poll attempt (calls the same fetch logic once); don't spam the endpoint. The normal 1s polling continues in the background. |
| Styling | A centered modal-like panel (not a toast), semi-transparent backdrop, clear typography, can copy the port/command for pasting. |

## Requirements
* R1: Detect "long disconnection" — track how long `snapshot.connected=false`
  continuously; after 30s, set a flag to show the diagnostic panel.
* R2: A `DiagnosticPanel` component (dismissable, shows checklist + how-to +
  current port + action buttons).
* R3: A "诊断" button in the status row (only visible when `!snapshot.connected`),
  clicking it manually opens the diagnostic panel (even if <30s).
* R4: [重试连接] button triggers one manual poll attempt (provide a "force poll"
  mechanism in `useGameSnapshot` or trigger via a ref/callback).
* R5: [修改端口] opens the settings panel (same as gear button).
* R6: Panel auto-hides when `snapshot.connected` becomes `true`.
* R7: Copy-friendly: display the command `-clientapi 6119` in a `<code>` or
  input field users can select/copy.

## Acceptance Criteria
* [ ] Open app with SC2 not running → after 30s, diagnostic panel appears.
* [ ] Click [关闭] → panel hides; click "诊断" in status row → panel re-opens.
* [ ] Start SC2 with `-clientapi 6119` while panel is open → panel auto-hides
      when connection succeeds.
* [ ] [重试连接] triggers one poll (visible in network tab or by checking
      `snapshot` update).
* [ ] [修改端口] opens settings panel.
* [ ] Checklist + how-to text is clear and actionable (Chinese).
* [ ] `pnpm build`, `pnpm test`, `tsc` green.

## Out of Scope
* Automated port scanning (checking if 6119 is occupied) — too invasive, just
  show the manual checklist.
* Detecting SC2 process (platform-specific, unreliable).
* Auto-adding the launch flag (no write access to Battle.net config).

## Definition of Done
* Follows `.trellis/spec/frontend/*` (typed state, function components, no
  console.log, immutable patterns, files focused).
* No new Tauri capability/command needed (pure frontend logic + existing
  snapshot data).
* Panel is screen-reader friendly (aria labels for actions).

## Technical Notes
- Track disconnection duration in `App.tsx` or a `useDiagnostic` hook: 
  `useEffect` watching `snapshot.connected`, accumulating time via a ref +
  `setInterval` (or simpler: just a timestamp + check after 30s timeout).
- "Force poll" for [重试连接]: expose a `refetch()` function from
  `useGameSnapshot` (call the listen event handler manually or trigger a
  one-off fetch). Keep it simple — the normal polling loop is already running.
- Styling: modal overlay (`position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.6);`), centered card with padding. Use existing
  `.overlay` color scheme for consistency.
