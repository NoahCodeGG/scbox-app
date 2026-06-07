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


## Session 17: Coherent window lifecycle: main close=hide + reopen + quit

**Date**: 2026-06-07
**Task**: Coherent window lifecycle: main close=hide + reopen + quit
**Branch**: `main`

### Summary

Closing the main window destroyed it so the overlay's edit/settings buttons (open_main) couldn't reopen it; also the overlay's useWindowControls quit the app on close (leftover) and conflicted with lib.rs hiding it. Fixes: main window close=hide handler in lib.rs (mirror overlay) so open_main re-shows it (+unminimize); removed invoke(exit_app) from useWindowControls onCloseRequested (Rust handler hides the overlay; position still saved) so closing overlay hides not quits; added a 退出 button to the MainWindow sidebar (exit_app); macOS dock reopen via .build()?.run() → RunEvent::Reopen shows the hidden main window. Updated useWindowControls.test.ts to assert position-save + no exit. 168 vitest, cargo 41, coverage held, build clean. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ac670e3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 18: Finish Base UI migration; drop Radix + Geist

**Date**: 2026-06-07
**Task**: Finish Base UI migration; drop Radix + Geist
**Branch**: `main`

### Summary

The user migrated shadcn primitives from Radix (radix-ui) to Base UI (@base-ui/react) but it didn't compile and left dead deps. Completed it: fixed the 2 tsc errors (Slider wrapper made generic over value so voiceRate flows a single number instead of value[0]; removed unused React import in scroll-area), verified Switch/Slider/Select/Dialog/Button/Input/etc. against Base UI APIs (Switch onCheckedChange + Dialog open/onOpenChange already matched; Select unchanged). Removed unused radix-ui dependency. Reconciled the font: Inter was already the live --font-sans (via @theme), so Geist was dead — removed @fontsource/geist-sans + its main.tsx imports, kept Inter + Fira Code. Updated frontend/ui-system.md to document Base UI + Inter. No behavior/IPC/type changes. 168 vitest, cargo 41, coverage held, build green. MANUAL TODO: macOS run-through of toggles/slider/select/dialog (runtime correctness of Base UI controls not fully caught by tsc).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `00bb530` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 19: Sidebar real icon + name; footer version-only

**Date**: 2026-06-07
**Task**: Sidebar real icon + name; footer version-only
**Branch**: `main`

### Summary

Sidebar branding: copied the real logo to src/assets/logo.png (bundled import), replaced the 'SC' text badge with the logo img + name 'SCBox Assistant' at the top; footer now shows only the version (dropped the duplicated product name) since the top shows the name. No IPC/type/behavior changes; useAppVersion unchanged. 168 vitest, cargo 41, coverage held, build green (logo bundled).

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9513da0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 20: Single-source app name + icon from backend

**Date**: 2026-06-07
**Task**: Single-source app name + icon from backend
**Branch**: `main`

### Summary

Made app name + icon single-sourced from the Tauri backend instead of hardcoded strings + a duplicate logo asset. useAppName() (getName → productName) used in the sidebar + SettingsPanel footer (removed hardcoded 'SCBox Assistant'). New app_icon Rust command returns a base64 data URL from include_bytes!(icons/128x128.png) (added base64 crate, registered in generate_handler!); useAppIcon() renders it in the sidebar. Deleted the duplicate src/assets/logo.png. Both hooks tested (mirroring useAppVersion). Additive app_icon command only; no other contract/behavior change. 176 vitest, cargo 41, coverage held, build green.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d5e8396` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 21: Global light/dark theme from Settings

**Date**: 2026-06-07
**Task**: Global light/dark theme from Settings
**Branch**: `main`

### Summary

Replaced the overlay-only Moon toggle with a global theme (浅色/深色/跟随系统) chosen in Settings, applied to both the main window and overlay. Additive Settings.theme ('light'|'dark'|'system', default system) mirrored Rust serde↔TS↔normalize. New useApplyTheme hook toggles .dark on documentElement; 'system' follows prefers-color-scheme + reacts to OS changes live; applied in MainWindow + App(overlay), synced cross-window via SETTINGS_CHANGED. index.css: @custom-variant dark switched from overlay-scoped .theme-dark to global .dark; overlay dark-glass now via .dark .overlay-card (kept --ov-* tokens). SettingsPanel gained an 外观 segmented control. Removed the overlay Moon button + local darkTheme state. Updated settings.rs/lib/settings/useSettings tests + ui-system spec. 183 vitest, cargo 41, coverage held (useApplyTheme 100%), build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `375e735` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 22: Themed overlay titlebar (main window)

**Date**: 2026-06-07
**Task**: Themed overlay titlebar (main window)
**Branch**: `main`

### Summary

The native macOS titlebar stayed white and didn't follow the app theme. Set the main window to titleBarStyle:Overlay + hiddenTitle (macOS) so the titlebar is transparent and the themed bg-secondary background shows through (native traffic lights kept). MainWindow: added an empty full-width data-tauri-drag-region top strip (select-none, no interactive children) so the window stays draggable, and a pt-7 top inset on the sidebar nav + main content so the logo clears the ~28px traffic-light zone; nav links stay clickable (outside the drag region). macOS-only config; Windows native bar unaffected (deferred). No IPC/type/behavior changes. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0e1a4a6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 23: Allow main window dragging (capability)

**Date**: 2026-06-07
**Task**: Allow main window dragging (capability)
**Branch**: `main`

### Summary

Main window couldn't be dragged after the overlay-titlebar change: data-tauri-drag-region calls startDragging which needs core:window:allow-start-dragging, but that perm was only on the overlay capability (removed from main during the window restructure). Added core:window:allow-start-dragging to capabilities/default.json (main), least-privilege (only that perm). cargo build/test, tsc, 183 vitest green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0f53d07` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 24: Unify app dark theme with overlay dark-glass

**Date**: 2026-06-07
**Task**: Unify app dark theme with overlay dark-glass
**Branch**: `main`

### Summary

Dark mode was inconsistent: main window used shadcn neutral grayscale, overlay used cyan dark-glass. Rewrote the .dark shadcn token block in index.css to derive from the overlay --ov-* source (background=ov-dark-surface, card/popover/secondary/muted/accent=ov-dark-raise, foreground=ov-dark-fg, muted-foreground=ov-dark-muted, primary/ring=ov-accent-cyan, primary-foreground=#06222a, border/input=ov-dark-border, sidebar* mapped likewise; destructive kept red; chart keys retained). Now the whole app dark theme matches the overlay. Single-sourced from :root --ov-*; light mode + .dark .overlay-card unchanged. Updated ui-system.md. CSS-only; 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `3dd150d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 25: Editable JSON pane replaces import/export

**Date**: 2026-06-07
**Task**: Editable JSON pane replaces import/export
**Branch**: `main`

### Summary

Replaced the low-value copy/paste import/export panel (BuildTransferPanel) with a two-way editable JSON pane. BuildJsonPreview → BuildJsonEditor (controlled textarea, valid/invalid header, 复制 button). BuildEditor keeps FORM canonical: JSON→form via parseImportedBuild on each change (invalid isolated, form untouched); form→JSON regenerated only when the pane isn't focused (gate prevents cursor-jump + sync loop), via exportBuildJson when valid else a lenient stringify so it always renders. Copy is best-effort navigator.clipboard. Deleted BuildTransferPanel.tsx/.css; kept buildTransfer.ts + test (reused). Save/delete/persistence unchanged. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1077148` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 26: Overlay click-through toggle button

**Date**: 2026-06-07
**Task**: Overlay click-through toggle button
**Branch**: `main`

### Summary

Added a 穿透模式 toggle button (MousePointer2) to the overlay header icon cluster. onClick flips settings.clickThrough via saveSettings (persists, applied by useWindowControls.setIgnoreCursorEvents, emits SETTINGS_CHANGED to sync the main window); active accent + aria-pressed when on; onMouseDown stopPropagation (drag-region rule). Disabling stays via the existing Ctrl+Shift+S (button unclickable once passthrough on). Reuses existing setting — no new IPC/type. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e585d7d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 27: Overlay resize measures full content (passthrough sliver)

**Date**: 2026-06-07
**Task**: Overlay resize measures full content (passthrough sliver)
**Branch**: `main`

### Summary

Enabling passthrough collapsed the overlay into a thin scrollbar sliver: the content-fit ResizeObserver sized the window to cardRef only, but auxiliary surfaces (穿透模式 hint, settingsError, voice install hint, loadError, parse errors) render outside the card inside <main className=p-2>; when shown they overflowed the card-sized transparent frameless window → scrollbar/sliver. Fix: moved the ref from the card to the <main> wrapper (cardRef→contentRef, HTMLElement) and size the window to el.offsetWidth/Height directly (dropped +16 since p-2 is included). Now the window hugs card + hints in every state; no-hint case unchanged. CSS/measurement only. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8687f9d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 28: Overlay fixed content width (no width fluctuation)

**Date**: 2026-06-07
**Task**: Overlay fixed content width (no width fluctuation)
**Branch**: `main`

### Summary

Toggling the overlay passthrough button changed the window width each click: the 穿透模式开启 hint (and other error/voice hints) were wider than the card, and the content-fit ResizeObserver measures the full <main> width, so showing/hiding a hint widened/narrowed the window. Fix: wrapped the overlay card + all auxiliary surfaces in a fixed w-[328px] column (mockup design width) inside <main className=p-2>; contentRef stays on <main> (offsetWidth constant 344). Hints now wrap within 328px; only height auto-fits, width is stable. Layout-only reparent; no behavior/IPC/type changes. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e3d7556` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 29: Fix overlay resize feedback-loop sliver

**Date**: 2026-06-07
**Task**: Fix overlay resize feedback-loop sliver
**Branch**: `main`

### Summary

Passthrough collapsed the overlay into a scrollbar sliver even after the fixed-width column fix. Real root cause: the content-fit ResizeObserver measured <main> (display:block → offsetWidth = window inner width minus scrollbar). When the hint briefly overflowed, a scrollbar appeared → <main>.offsetWidth shrank ~15px → setSize shrank the window → still overflowed → runaway shrink to a sliver. Fix: moved contentRef to the inner w-[328px] column (intrinsic width, scrollbar-immune) and added +16 (the <main> p-2) → constant 344 width, no feedback. Added overflow:hidden to html/body/#root (overlay never scrolls; main window scrolls inside its own overflow-auto container, verified). Measurement+CSS only. 183 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a2187c6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 30: Customizable click-through shortcut

**Date**: 2026-06-07
**Task**: Customizable click-through shortcut
**Branch**: `main`

### Summary

Made the 穿透模式 global shortcut configurable instead of hardcoded CmdOrCtrl+Shift+S. Additive Settings.clickThroughShortcut (default CmdOrCtrl+Shift+S) mirrored Rust serde↔TS↔normalize. Rust register_clickthrough_shortcut(app, accel) does unregister_all() then on_shortcut(accel → emit ui://toggle-clickthrough); called in setup from the loaded setting and at the end of save_settings for live re-registration (invalid accel caught/logged). New src/lib/shortcut.ts buildAccelerator (≥1 modifier + main key, Ctrl/Meta→CmdOrCtrl, rejects shift-only/pure-modifier) + formatAccelerator + tests. SettingsPanel 穿透快捷键 recorder row (record next keydown, Esc cancel, 重置 default; hint shows live shortcut). Event name unchanged; overlay listener untouched. trellis-check passed (no duplicate registration, no cross-layer drift). 196 vitest, cargo 41, coverage held, build green. Manual macOS confirm pending.

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `232d55c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 31: 移除 build step 人口字段

**Date**: 2026-06-07
**Task**: 移除 build step 人口字段
**Branch**: `main`

### Summary

将 BuildStep 简化为 time+say，删除 supply 字段及编辑器人口输入/估算与 supplyTime 工具，保留旧 JSON 向后兼容（serde 忽略未知字段），两端测试全绿。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6d7845d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
