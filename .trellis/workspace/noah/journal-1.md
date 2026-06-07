# Journal - noah (Part 1)

> AI development session journal
> Started: 2026-06-06

---



## Session 1: SC2 build-order voice assistant MVP + spec bootstrap

**Date**: 2026-06-06
**Task**: SC2 build-order voice assistant MVP + spec bootstrap
**Branch**: `main`

### Summary

Bootstrapped Trellis spec layers (frontend + tauri) from the create-tauri-app scaffold, then built the SC2 assistant MVP: Rust polls the SC2 Client API at 6119 and emits game snapshots; frontend schedules a local-JSON build order against the in-game clock and speaks zh-CN Web Speech cues with configurable lead time. Live voice verified in WKWebView. Initialized git and committed PR1+PR2.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1e94b67` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 2: Connection diagnostics + multi-monitor position fix

**Date**: 2026-06-06
**Task**: Connection diagnostics + multi-monitor position fix
**Branch**: `main`

### Summary

Implemented connection diagnostics panel (30s threshold, how-to guide, retry/settings/dismiss actions). Fixed multi-monitor window position persistence on macOS Retina (physical/logical coordinate conversion, eliminate startup flicker). Updated frontend spec with modal overlay and timer hook patterns.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `89cf499` | (see git log) |
| `1129780` | (see git log) |
| `2f22ed9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 3: In-app build order editor (+ supply→time helper)

**Date**: 2026-06-06
**Task**: In-app build order editor (+ supply→time helper)
**Branch**: `main`

### Summary

Built a dedicated editor window for CRUD over build orders with a supply→time helper. Added supply? field + StoredBuild filename mapping (TS+Rust), save/delete/open_editor commands with path-traversal guard, a second 'editor' window + capability + label routing (close=hide), pure supplyTime/buildValidation/buildFilename helpers with tests, BuildEditor UI, overlay reload via builds-changed event, and tauri/multi-window spec. Follow-up fixes: in-app delete confirm (window.confirm is a no-op in WKWebview), save/delete status banner, race+opponent dropdowns deriving matchup. Mac-first; Windows verification deferred. tsc clean, 97 vitest, 34 cargo.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `5192d01` | (see git log) |
| `9edde0d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 4: Build order import/export via clipboard JSON

**Date**: 2026-06-06
**Task**: Build order import/export via clipboard JSON
**Branch**: `main`

### Summary

Added clipboard/text-based build import/export from the editor with no new plugin. New buildTransfer.ts (exportBuildJson filename-free, omits unset supply; parseImportedBuild guards JSON.parse then reuses validateBuild). New BuildTransferPanel (textarea + 导出/复制/导入; best-effort navigator.clipboard with manual fallback; import always writes a new auto-suffixed file via save_build_order then reload + builds-changed event). Reuses existing validation/persistence, no backend change. tsc clean, 113 vitest, 34 cargo.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `058897b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 5: Hook-layer unit tests with jsdom + coverage gate

**Date**: 2026-06-06
**Task**: Hook-layer unit tests with jsdom + coverage gate
**Branch**: `main`

### Summary

Established a hook-testing harness and real tests for all custom hooks (replacing placeholder useConnectionDiagnostic tests). Added @testing-library/react + jsdom + coverage-v8; per-file '// @vitest-environment jsdom' docblock so pure libs stay node; src/test/tauriMocks.ts typed invoke/listen/window mocks mirroring the real IPC contract; tests for the 6 PRD hooks + useConnectionDiagnostic + useBuildOrders; coverage gate scoped to src/hooks/** = 80% via test:coverage. Captured frontend/hook-testing.md spec. 146 vitest (33 new), hooks ≥80% all metrics, tsc clean, cargo 34. No hook behavior changed.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8a67a49` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 6: 6119 connection lifecycle hardening

**Date**: 2026-06-06
**Task**: 6119 connection lifecycle hardening
**Branch**: `main`

### Summary

Hardened SC2 Client API polling: 800ms request timeout (<1s base) so stalled sockets can't back up ticks; classify outcomes into a typed ConnectionStatus enum (ok/unreachable/timeout/bad_http/bad_body) with only-parse-on-2xx so a foreign service on the port no longer reads as connected; connected derived = status==ok; exponential backoff x2 capped 5s while disconnected, resets to 1s on reconnect (pure next_poll_interval_ms); DiagnosticPanel shows a status-specific reason line; GameSnapshot/ConnectionStatus mirrored in types/sc2.ts + fixtures. cargo 41, vitest 146, coverage held, tsc clean.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2f3c61f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 7: Voice cue queue + persistent native TTS worker

**Date**: 2026-06-06
**Task**: Voice cue queue + persistent native TTS worker
**Branch**: `main`

### Summary

Fixed bunched build-order TTS overlap/clobber/stale. Frontend: a single FIFO speech queue in lib/speech.ts plays one cue at a time and drops cues past a 3s freshness window (web advances on utterance onend/onerror, native paced by estimateDurationMs); speak() enqueues, cancelAll() clears. Rust: replaced the per-call construct/interrupt=true/drop pattern (which made bunched native cues cancel each other) with one long-lived Tts on a dedicated worker thread fed by an mpsc channel, speaking interrupt=false; only the Sender is app.manage()d (Tts is !Send), speak_tts/stop_tts now send TtsCommand msgs. invoke contract unchanged. Added tauri/index.md note on the !Send worker-thread pattern. 152 vitest, cargo 41, coverage held, tsc/clippy clean. Native runtime is Windows-deferred; macOS web tier fully fixed+testable.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `33db0f8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 8: Branding metadata + in-app version

**Date**: 2026-06-06
**Task**: Branding metadata + in-app version
**Branch**: `main`

### Summary

Branded the app off scaffold defaults (S1+S2 of the packaging item). productName + main window title -> 'SCBox Assistant'; Cargo description/authors set; identifier (com.scbox-app.app) and version (0.1.0) left unchanged to preserve the app-data dir. New useAppVersion hook reads getVersion() at runtime (null on failure, unmount-safe) + test; SettingsPanel shows a 'SCBox Assistant v{version}' footer. getVersion permission already covered by core:default. Documented deferred S4 auto-update (needs signer keypair + GitHub secrets + Releases/latest.json) and S5 Windows code signing (needs paid cert) in the CI workflow note; gitignored coverage/. 156 vitest, cargo 41, coverage held, build OK. Deferred per repeated AskUserQuestion timeouts: icon (needs source asset), auto-update, signing.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2b82586` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 9: App icon + Tauri auto-update

**Date**: 2026-06-07
**Task**: App icon + Tauri auto-update
**Branch**: `main`

### Summary

Added the real app icon (regenerated icons/* from the user's logo at src-tauri/icons/source.png; removed unused android/ios dirs) and Tauri 2 auto-update. Updater: tauri-plugin-updater + tauri-plugin-process registered; plugins.updater config with GitHub latest.json endpoint + bundle.createUpdaterArtifacts; minimal updater:default + process:allow-restart capability; a committed THROWAWAY public placeholder pubkey (user replaces it). useUpdateCheck hook (check-on-launch, fully defensive try/catch, typed) + tests; overlay update banner + Settings 检查更新 button (hook lifted to App, single instance). release.yml: tag-driven (v*) windows+macos matrix via tauri-action, draft release, TAURI_SIGNING_* secret env. docs/AUTO_UPDATE.md handoff. Decisions: user generates the production keypair; Windows+macOS; check+prompt UX; tag-driven. 165 vitest, cargo 41, coverage held, dev boots clean. User manual steps before first release: generate keypair, replace pubkey, add 2 GitHub secrets, bump version, push v tag, publish draft. Pre-existing flaky useSettings.test.ts voiceRate clamp test flagged (unrelated, not fixed).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d9e4adf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 10: Redesign UI with shadcn/ui (overlay/editor/settings)

**Date**: 2026-06-07
**Task**: Redesign UI with shadcn/ui (overlay/editor/settings)
**Branch**: `main`

### Summary

Re-skinned the 3 in-app surfaces to the user's mockups with Tailwind v4 + shadcn/ui (new-york/neutral), no behavior change. PR0 foundation (0ff7efa): @tailwindcss/vite, components.json, @/ alias in tsconfig+vite+vitest, theme tokens in src/index.css (black accent, Geist+Fira Code), self-hosted fonts via @fontsource, 11 ui primitives, overlay-scoped dark variant wired (no global .dark). PR1 settings (c1118b8): SettingsPanel → shadcn Card/Switch/Slider/Input, css removed. PR2 editor (8ce35d8): BuildEditor → 3-region layout (list|form|sticky JSON preview) + new BuildJsonPreview with live valid/invalid indicator; all features kept (selects/derived matchup/supply→time/delete-confirm/transfer). PR3 overlay (62b6841): App.tsx → .overlay card (drag bar, interpolated clock, pulsing dot, 3-step current/upcoming + firing anim, voice/lead footer, waiting/replay/disconnected banners, dark-glass theme); DiagnosticPanel → shadcn Dialog; App.css+DiagnosticPanel.css removed; main window 320x200→360x340. Scope: only in-app screens (overlay/editor/settings); dashboard+onboarding (net-new) and marketing pages deferred. Mockups were 8 static HTML files in ~/Downloads/scbox-app. Decisions made via research because AskUserQuestion kept timing out. trellis-check passed each phase; drag-region/clock/voice/IPC all preserved. Spec: frontend/ui-system.md. 165 vitest, cargo 41, coverage held, build ok. KEY MANUAL TODO: macOS run-through of overlay drag/click-through/live coaching/dark theme not yet done.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0ff7efa` | (see git log) |
| `c1118b8` | (see git log) |
| `8ce35d8` | (see git log) |
| `62b6841` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 11: Two-window architecture: dashboard shell + launchable overlay

**Date**: 2026-06-07
**Task**: Two-window architecture: dashboard shell + launchable overlay
**Branch**: `main`

### Summary

Corrected the window model to match the prototype. Main window is now a normal desktop window rendering a react-router sidebar shell (Dashboard / Build Order / Settings pages); the overlay is a SEPARATE always-on-top window, hidden by default, launched via open_overlay from the dashboard. PR1 (6bbd34b): tauri.conf windows (main visible/non-top 1000x680; new hidden alwaysOnTop overlay; editor window removed), capabilities moved (window-control perms→overlay, main keeps updater/process/opener), lib.rs open_editor→open_overlay/hide_overlay/open_main + position-restore/close=hide retargeted to overlay, main.tsx routes overlay→App / main→MainWindow, react-router-dom added, editor+settings became routes. PR2 (a6baef3): Dashboard cards (连接状态/当前对局/Build Order自动匹配/步骤预览) from real hooks + 启动/隐藏悬浮窗 toggle; additive Settings.activeBuildOverride (Rust serde + TS, default null) for manual build override with auto fallback; SETTINGS_CHANGED event so the overlay live-reloads settings; overlay slimmed (removed settings popover + update banner, gear→open_main); settings as a page. Decisions: react-router, manual override, mgmt consolidated to main, no onboarding. trellis-check passed both PRs (no emit/reload loop, graceful override-missing fallback, drag/click-through/clock/voice preserved). 168 vitest, cargo 41, coverage held, build ok. KEY MANUAL TODO: macOS run-through — main opens to dashboard, overlay launches/hides, drag/click-through, live settings+override sync.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6bbd34b` | (see git log) |
| `a6baef3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 12: Frameless transparent overlay + clickable buttons

**Date**: 2026-06-07
**Task**: Frameless transparent overlay + clickable buttons
**Branch**: `main`

### Summary

Fixed the overlay window: it was showing full macOS chrome + a big empty white area, and the top-bar icon buttons didn't respond. Made the overlay window decorations:false + transparent:true + shadow:false (+ app.macOSPrivateApi:true and tauri macos-private-api cargo feature, required for macOS transparency) so only the rounded card shows. Made the shared page background transparent (html/body/#root) and gave MainWindow an opaque bg (bg-secondary) so the main window is unaffected. Added content-fit sizing: a ResizeObserver on .overlay-card calls getCurrentWindow().setSize so the window hugs the card across states (waiting/live/dark), with core:window:allow-set-size added to the overlay capability. Fixed dead buttons: the icon buttons were children of the data-tauri-drag-region bar (macOS drag swallows mousedown) — added onMouseDown stopPropagation to all 5 buttons so clicks fire while the bar still drags. No IPC/type changes. 168 vitest, cargo 41, coverage held, build ok. MANUAL TODO: macOS run-through to confirm only-card render + buttons + drag.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e8f6556` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 13: Move connection diagnostic from overlay to dashboard

**Date**: 2026-06-07
**Task**: Move connection diagnostic from overlay to dashboard
**Branch**: `main`

### Summary

Fixed the diagnostic modal overflowing/not-scrolling in the now content-fit frameless overlay. Removed DiagnosticPanel + useConnectionDiagnostic + the 诊断 button from the overlay (App.tsx) — the compact 未连接 banner remains. Hosted the diagnostic in the dashboard 连接状态 card (main window, room to scroll): a 诊断/如何启用 button + 30s-disconnect auto-open via useConnectionDiagnostic; onRetry=refetch (useGameSnapshot), onOpenSettings=navigate('/settings'). Made DiagnosticPanel DialogContent scroll-safe (max-h-[85vh] overflow-y-auto). No IPC/type changes; 168 vitest, cargo 41, coverage held, build ok. MANUAL TODO: macOS run-through.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c383464` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 14: Soften overlay card shadow halo

**Date**: 2026-06-07
**Task**: Soften overlay card shadow halo
**Branch**: `main`

### Summary

The transparent content-fit overlay showed a dark halo around the card — it was the card's heavy drop shadow (0 18px 50px -12px rgba(0,0,0,0.55)) bleeding into the 8px transparent ring and clipping. Replaced it with a tight shadow (0 2px 8px rgba(0,0,0,0.18)) in App.tsx; dark theme has no own box-shadow so it inherits. border+rounded still define the card. tsc/168 vitest/cargo 41/build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e4c40be` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 15: Overlay header drag region non-selectable

**Date**: 2026-06-07
**Task**: Overlay header drag region non-selectable
**Branch**: `main`

### Summary

Dragging the overlay over the left header text (grip/matchup/race) selected text instead of moving the window. Added select-none to the data-tauri-drag-region title-bar div in App.tsx (user-select:none inherits to child spans) so the native window drag starts on mousedown; buttons still click via their existing onMouseDown stopPropagation. Noted the rule in frontend/ui-system.md. CSS-only; 168 vitest, cargo 41, coverage held, build green.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2bfc400` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 16: Overlay header text draggable (pointer-events-none)

**Date**: 2026-06-07
**Task**: Overlay header text draggable (pointer-events-none)
**Branch**: `main`

### Summary

Dragging the overlay over the left header text still didn't move the window after the select-none fix. Root cause: Tauri 2 data-tauri-drag-region only drags when the mousedown TARGET element itself has the attribute (no ancestor walk); the text spans are children without it. Fix: add pointer-events-none to the decorative left text container in App.tsx so the mousedown falls through to the drag-region bar. Right-side buttons keep pointer events + stopPropagation. Noted the rule in ui-system.md. CSS-only; 168 vitest, cargo 41, coverage held, build green.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f05a368` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
