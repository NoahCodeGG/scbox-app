# Move connection diagnostic out of the overlay into the dashboard

## Goal

Stop showing the connection-diagnostic modal in the overlay window — it overflows
and can't scroll now that the overlay is a tiny content-fit/frameless window.
Relocate the diagnostic help to the main window's dashboard 连接状态 card, where
there is room to scroll.

## What I already know

- `src/App.tsx` (overlay) currently renders `<DiagnosticPanel>` via `useConnectionDiagnostic` + a "诊断" button (shown when disconnected). With the overlay now frameless + content-fit-sized to the card, the full `Dialog` overflows / clips / can't scroll (screenshot).
- `src/components/DiagnosticPanel.tsx` is a shadcn `Dialog` with props `{ isOpen, currentPort, status, onClose, onOpenSettings, onRetry }` — shows a checklist + "如何启用 Client API" how-to + a read-only `-clientapi {port}` field + actions (重试连接 / 修改端口 / 关闭).
- `src/components/Dashboard.tsx` has a `ConnectionCard` (连接状态) fed by `useGameSnapshot`; it shows connected/disconnected. It does NOT currently link to the diagnostic.
- The earlier architecture decision (Q3) already said diagnostics/settings/updates live in the MAIN window; the overlay leftover is the bug.
- `useConnectionDiagnostic(connected)` = a 30s-disconnect timer + open/close controls (it auto-opens after 30s disconnected). That auto-open behavior in the overlay is exactly what's broken.

## Decisions

- **Remove the diagnostic from the overlay**: drop `DiagnosticPanel`, `useConnectionDiagnostic`, the `showDiagnostic`/open/close wiring, and the overlay "诊断" button from `App.tsx`. The overlay's existing "SC2 未连接 / 请启动星际争霸2…" banner is sufficient there.
- **Relocate to the dashboard**: in `Dashboard.tsx`, the `ConnectionCard` gets a "诊断 / 如何启用" Button (visible when disconnected, or always) that opens `DiagnosticPanel` as a Dialog IN THE MAIN WINDOW (room to scroll). Wire its props from the dashboard: `currentPort` from settings, `status` from the snapshot, `onRetry` → refetch, `onOpenSettings` → navigate to `/settings` (react-router). Keep the auto-open-after-30s behavior OPTIONAL in main (it's fine to keep `useConnectionDiagnostic` in the dashboard, since the main window can show a modal properly) OR make it manual-only — your call; manual button is the minimum.
- **DiagnosticPanel scroll safety**: ensure its `DialogContent` has a max-height + overflow so even on small main-window sizes it scrolls (defensive).

## Requirements

- Overlay no longer renders any diagnostic modal; no "诊断" button in the overlay; no auto-opening dialog in the overlay.
- The dashboard 连接状态 card exposes the diagnostic (button → DiagnosticPanel dialog) in the main window, scrollable, with 重试/修改端口(→/settings)/关闭 working.
- No regression to overlay connection display (banner/dot) or to `useGameSnapshot`.

## Acceptance Criteria

- [ ] When SC2 is disconnected, the overlay shows ONLY its compact banner — no clipped/unscrollable modal.
- [ ] The dashboard connection card opens a working, scrollable diagnostic dialog in the main window; 修改端口 routes to Settings; 重试连接 refetches.
- [ ] No dangling imports/state in App.tsx (tsc noUnusedLocals clean).
- [ ] tsc / vitest / coverage / cargo green; build ok; macOS run-through.

## Out of Scope

- Redesigning the diagnostic content; Windows verification.

## Technical Notes

- `DiagnosticPanel` props/behavior unchanged (reused as-is in the dashboard). Only the host moves overlay→main.
- If `useConnectionDiagnostic` ends up unused after removing it from the overlay (and you use manual open in the dashboard instead), either reuse it in the dashboard or leave it (it still has tests) — don't break its tests.
- No IPC/type changes.
