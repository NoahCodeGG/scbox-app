# Settings panel (lead time, 6119 port, voice toggle/rate)

## Goal

Replace the scattered, minimal player-name input (added in #4) with a proper
settings panel, and make user-facing knobs actually configurable: build-order
**lead time**, the SC2 Client API **port** (some users launch with
`-clientapi <port>`), and **voice** on/off + rate. Extends the existing
`Settings` (Rust `settings.rs` + `useSettings`). Also clean up the now-dead
`pickActiveBuild` left after #4.

## Background (existing code — verified)
- `Settings` today = `{ playerName: string }` only. Rust `src-tauri/src/settings.rs`
  (`#[serde(rename_all="camelCase")]`, `#[serde(default)]` per field, unknown keys
  ignored, pure parse/serialize/load/save + tests). TS mirror in `useSettings.ts`
  (`{ settings, saveSettings, error }`).
- The 6119 endpoint is a **hardcoded const** `GAME_URL = "http://127.0.0.1:6119/game"`
  in `src-tauri/src/sc2.rs`; the poll loop in `lib.rs` calls `fetch_snapshot(&client)`
  every 1s and emits `sc2://game`. There is NO way to change the port at runtime today.
- Lead time currently comes from each build order's `leadTimeSec` field. Voice
  always on; rate is the Web Speech / native default.
- `pickActiveBuild` in `src/lib/builds.ts` is now unused by `App.tsx` (superseded
  by `selectBuild`) but still exported + tested.

## Settings schema (extended — all with serde defaults for back-compat)
```
Settings {
  playerName: string        // existing
  clientApiPort: number      // default 6119
  leadTimeSecOverride: number | null  // null = use each build's leadTimeSec; else override
  voiceEnabled: boolean      // default true
  voiceRate: number          // default 1.0 (Web Speech rate; clamp 0.5–2.0)
}
```
Old `settings.json` with only `playerName` must still load (missing keys → defaults).

## Decisions (locked, autonomous)
| Topic | Decision |
|-------|----------|
| Port change application | The poll loop reads the port from **shared in-memory state** (Tauri-managed `Arc<Mutex<u16>>` or similar), seeded from settings at startup and updated by `save_settings`. So a port change takes effect on the **next poll tick**, no restart. `fetch_snapshot` takes the URL/port as a parameter (no more hardcoded const). |
| Lead time | `leadTimeSecOverride` (nullable). When set, it overrides the active build's `leadTimeSec` in the scheduler; when null, the build's own value is used. |
| Voice | `voiceEnabled` gates `speak()` (no-op when off). `voiceRate` passed to the Web Speech utterance (and Rust `speak_tts` if the crate exposes rate; else web-only for now). |
| Panel UX | A settings view toggled from the overlay (gear/“设置” button) — a simple panel, not a separate window. Player name moves into it. Keep the overlay compact when the panel is closed. |
| Validation | Port 1–65535 (default 6119 on invalid); rate clamped 0.5–2.0; lead-time override ≥ 0 or null. Validate in a pure helper + unit-test. |
| Persistence | All via the existing `save_settings`/`load_settings` (no new command except wiring the port into the shared state). |

## Requirements
* R1: Extend Rust `Settings` with the new fields (serde defaults; old files load).
  Update `useSettings` TS `Settings` to match. Cross-layer contract stays aligned.
* R2: Make the SC2 endpoint port runtime-configurable: remove the hardcoded
  `GAME_URL` const, build the URL from a port held in Tauri-managed shared state;
  seed it from settings at startup; `save_settings` updates it; the poll loop uses it.
* R3: A pure `normalizeSettings`/validation helper (clamp port/rate/lead time);
  unit-tested.
* R4: Scheduler uses `leadTimeSecOverride ?? build.leadTimeSec`. Voice respects
  `voiceEnabled` (gate `speak`) and `voiceRate`.
* R5: A settings panel component toggled from the overlay; edits persist via
  `saveSettings`; player-name field relocated here. Overlay stays compact when closed.
* R6: Delete the dead `pickActiveBuild` (and its now-irrelevant test) since
  `selectBuild` supersedes it — confirm nothing else imports it.

## Acceptance Criteria
* [ ] Old `settings.json` (only `playerName`) loads without error; new fields default.
* [ ] Changing the port in the panel changes which endpoint the poll loop hits on
      the next tick (verified by logic/tests; live confirm is manual).
* [ ] Lead-time override changes when cues fire; null falls back to the build value.
* [ ] Voice off → no speech; rate is applied to utterances.
* [ ] Validation helper unit-tested (port/rate/lead-time bounds).
* [ ] `pickActiveBuild` removed; no dangling import; build green.
* [ ] `cargo test`, `tsc`, `pnpm build`, `pnpm test` green.

## Out of Scope
* Overlay drag/click-through/opacity (task #6).
* In-app build-order editor (#7); per-build voice selection.
* Auto-detecting the port from SC2 launch args.

## Definition of Done
* Follows `.trellis/spec/tauri/*` (managed-State for the shared port, command
  contract synced, Result<T,E>) and `.trellis/spec/frontend/*` (typed invoke,
  immutable state, pure validation separated + tested, function components).
* Cross-layer: extended `Settings` Rust serde ⇄ TS aligned; the shared-port
  state wiring documented.

## Technical Notes
* Shared port state: `app.manage(Arc<Mutex<u16>>)` (a `u16`/port is `Send+Sync`,
  unlike the `tts::Tts` from #2 — this one is fine to manage). The poll loop in
  `lib.rs::setup` reads it each iteration; `save_settings` writes it. `fetch_snapshot`
  gains a `port: u16` (or full URL) parameter.
* Be careful the poll loop's lock is held briefly (read port, drop lock, then await
  the HTTP request) — never hold a `std::sync::Mutex` guard across `.await`.
* Lead-time override + voice gating touch `useBuildOrderVoice` / `speech.ts`;
  keep the existing tests green and the StrictMode double-speak guard intact.
