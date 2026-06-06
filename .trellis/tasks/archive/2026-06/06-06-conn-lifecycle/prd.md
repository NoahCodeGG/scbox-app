# 6119 connection lifecycle hardening

## Goal

Make the SC2 Client API (6119) polling robust across the real connection
lifecycle — SC2 not running, wrong/occupied port, timeouts, a foreign service on
the port, game start/end/restart, replay — so the overlay reports accurate state
and never mis-fires or stalls, and the diagnostic can explain *why* it's
disconnected.

## What I already know

- Poll loop (`src-tauri/src/lib.rs`): every 1s reads the shared port, `fetch_snapshot`, `emit("sc2://game")`. Runs forever at a fixed 1s cadence.
- `src-tauri/src/sc2.rs` `fetch_snapshot(client, port)`:
  - connection error → `disconnected()` (connected:false).
  - reachable but body not parseable as `RawGame` → `{ connected:true, in_game:false }` (treated as "connected, idle"). **No HTTP status check — `resp.json()` runs regardless of status code.**
  - parsed → `from_raw`: `in_game = !players.is_empty()`, carries `is_replay`, `display_time`, `players`.
  - **No per-request timeout** on the reqwest client/get.
- `GameSnapshot { connected, in_game, is_replay, display_time, players }` is the cross-layer contract (mirrored `src/types/sc2.ts`). Only a `connected` bool — no disconnect reason.
- Frontend: `useGameSnapshot` listens; `useConnectionDiagnostic` shows a panel after 30s disconnected; `useInterpolatedClock` re-anchors/freezes; `useBuildOrderVoice` resets on game end/replay; matchup `resolveMe` = first `type:"user"` else `players[0]` (no isLocal flag in the API).
- Tests: `sc2.rs` has parse/url unit tests (cargo 34 total); hooks covered.

## Decisions

- **(Q1) Scope = A + B + C + D** (all four hardening items). E (players[0]) stays document-only.
- **(Q2) Disconnect reason = typed `status` enum.** `GameSnapshot` gains `status: ConnectionStatus` where `ConnectionStatus = "ok" | "unreachable" | "timeout" | "bad_http" | "bad_body"`. `connected` stays as a derived convenience (`status === "ok"`). The diagnostic switches on `status` for a localized reason line.
- **(Q3) Backoff = exponential ×2 capped at 5s.** While disconnected: 1s→2s→4s→5s→5s…; resets to 1s immediately on a reconnected tick.

## Requirements

- **A**: reqwest request timeout of 800ms (< the 1s base poll) so a stalled socket can't back up ticks. A timeout maps to `status:"timeout"`.
- **B**: only parse the body on a 2xx response; a non-2xx → `status:"bad_http"`; a 2xx body that doesn't parse as `RawGame` → `status:"bad_body"` (NOT the old "connected idle"). The legitimate idle state (SC2 returns valid JSON with empty players) stays `status:"ok"`, `in_game:false`.
- **C**: `status` enum on the snapshot (see Q2); `DiagnosticPanel` shows a reason line based on it.
- **D**: poll loop interval follows a pure backoff function keyed on `connected`; resets to 1s on reconnect.

## Acceptance Criteria

- [ ] A stalled/slow endpoint yields `status:"timeout"` within ~800ms instead of blocking the tick.
- [ ] A foreign service on the port (non-2xx or non-RawGame body) reports `status:"bad_http"`/`"bad_body"` and `connected:false` — not a false "connected".
- [ ] SC2 not running → `status:"unreachable"`, `connected:false`.
- [ ] Idle-between-games (valid empty payload) → `status:"ok"`, `connected:true`, `in_game:false` (unchanged behavior).
- [ ] While disconnected the poll interval grows 1→2→4→5s and snaps back to 1s on reconnect.
- [ ] The diagnostic panel shows a reason line that differs by `status`.
- [ ] `connected`/`in_game` consumers (App, hooks) keep working unchanged; `DISCONNECTED_SNAPSHOT` carries a sensible `status`.

## Technical Approach

- **`src-tauri/src/sc2.rs`**:
  - Add `enum ConnectionStatus` with `#[serde(rename_all = "snake_case")]` → serializes to exactly `ok|unreachable|timeout|bad_http|bad_body`. Mirror as a TS union.
  - `GameSnapshot` gains `pub status: ConnectionStatus`; `connected` retained (set true only for `ok`). Update `disconnected()` (→ `unreachable`), `from_raw` (→ `ok`).
  - `fetch_snapshot`: on `Err(e)` use `e.is_timeout()` → `Timeout` else `Unreachable`; on `Ok(resp)` check `resp.status().is_success()` else `BadHttp`; then `resp.json::<RawGame>()` → `Ok`→`from_raw`, `Err`→`BadBody`. Keep helpers small + pure where possible (e.g. a `classify`/builder that maps parts → snapshot, unit-tested; status serialization tested).
  - Add pure `fn next_poll_interval_ms(current_ms: u64, connected: bool) -> u64` (base 1000, ×2 cap 5000; connected→1000). Unit-test the curve.
- **`src-tauri/src/lib.rs`**: build the reqwest `Client` with `.timeout(Duration::from_millis(800))`; in the poll loop, track the current interval and `sleep` for `next_poll_interval_ms(current, snapshot.connected)` instead of a fixed 1s.
- **`src/types/sc2.ts`**: add `ConnectionStatus` union + `status` to `GameSnapshot`; set `DISCONNECTED_SNAPSHOT.status = "unreachable"`. Keep field names aligned.
- **Frontend diagnostic**: `DiagnosticPanel` takes the `status` (or snapshot) and renders a reason line (unreachable→“SC2 未运行或端口不对”, timeout→“连接超时”, bad_http/bad_body→“端口被其他程序占用？”). `useConnectionDiagnostic` keeps gating on `connected`.
- **Test fixtures**: any test building a `GameSnapshot` (tauriMocks/hook tests) must add the new `status` field — update them so vitest stays green.

## Implementation Plan (small PRs / phases)

- **PR1 (Rust)**: `ConnectionStatus` + `status` field + `fetch_snapshot` classification + `next_poll_interval_ms` + client timeout + poll-loop backoff; cargo unit tests (status serialization, classify parts, backoff curve).
- **PR2 (Frontend)**: `types/sc2.ts` contract update + `DISCONNECTED_SNAPSHOT`; `DiagnosticPanel` reason line; update test fixtures; macOS run-through.

## Out of Scope (explicit)

- Reworking matchup local-player detection beyond documentation (no API signal).
- Changing the 1s base cadence or the 30s diagnostic delay.
- Windows real-machine verification (deferred).

## Technical Notes

- Cross-layer seam: `GameSnapshot` + `ConnectionStatus` must stay in lockstep across `sc2.rs` and `types/sc2.ts` (see cross-layer guide). `connected` is derived from `status` — keep it consistent so existing consumers don't break.
- Keep the poll loop body small; decision logic (classification, backoff) lives in pure `sc2.rs` functions.
