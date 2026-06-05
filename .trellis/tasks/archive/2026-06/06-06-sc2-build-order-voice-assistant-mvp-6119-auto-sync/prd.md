# SC2 Build-Order Voice Assistant — MVP (6119 auto-sync)

## Goal

A StarCraft II desktop assistant (Tauri 2 + React + TS) that reads the in-game
clock from the local SC2 Client API and **speaks the player's own build order at
the right moments**, so the player keeps correct ladder pacing without watching a
phone. Replaces running the mobile **SCBox** app on a separate device.

## Decisions (locked, 2026-06-06)

| Topic | Decision |
|-------|----------|
| Timing source | Auto-sync via SC2 Client API `GET http://localhost:6119/game` (`displayTime`, `isReplay`, `players[].race/name/result`) |
| Build-order content | User curates himself; no SCBox/liquipedia import |
| Trigger model | **Pure time-trigger** — cues keyed to `displayTime` (API has no supply/resource data) |
| MVP scope | **Single matchup**, player race = **Terran**; one real build order to prove the loop. Engine designed for `{matchup → build}` but MVP ships one build. |
| Voice (TTS) | **Web Speech API** (`speechSynthesis`) in the frontend; macOS WKWebView Chinese voice |
| Build authoring | **Hand-edited local JSON** (no in-app editor in MVP) |
| Cue timing | **Announce-ahead** — speak each cue N seconds before its target time; lead time configurable (default ~4s) |

## Architecture

```
Rust backend: poll 6119 (~1s) → parse displayTime + isReplay + players(race,result)
   → emit Tauri events (game state) to frontend
Frontend: on live game start, load build order JSON → schedule cues vs displayTime
   → speak each cue (lead-time ahead) via Web Speech API → stop on game end
Window: always-on-top / overlay
```

## Build Order JSON (shape, to refine in implementation)

```json
{
  "matchup": "TvP",
  "race": "Terran",
  "leadTimeSec": 4,
  "steps": [
    { "time": 18, "say": "造补给站" },
    { "time": 30, "say": "造兵营" }
  ]
}
```
`time` = `displayTime` seconds for the action; assistant speaks at `time - leadTimeSec`.

## Requirements

* R1: Rust backend polls `127.0.0.1:6119/game` ~1s and pushes parsed state to the
  frontend via Tauri events. Polling must run even before/after a game (idle).
* R2: Detect live-game start (valid response, `isReplay: false`) and game end
  (`result` populated, or endpoint stops returning a game) and reset between games.
* R3: On live-game start, load the matchup's build order JSON and schedule cues.
* R4: Speak each step via Web Speech API at `time - leadTimeSec` (announce-ahead).
* R5: Build order is a hand-edited local JSON file with the shape above.
* R6: Overlay window: always-on-top, shows connection/game status + current/next step.
* R7: Identify "me" among players (configured SC2 player name) so race/matchup and
  display are correct; MVP runs the single authored build for a live game.

## Edge-case behavior (defaults — confirm)

* **Mid-game start / late connect**: if `displayTime` is already past earlier
  steps, skip the backlog (do not replay missed cues); resume from the next
  upcoming step.
* **Replay** (`isReplay: true`): do not run the assistant.
* **No game / SC2 closed**: endpoint refuses or returns no game → idle state, keep
  polling, no crash.
* **Game end**: stop speaking, clear scheduled cues, return to idle.
* **Speech overlap**: if cues bunch up, queue them (don't talk over self) —
  default behavior of `speechSynthesis`.

## Acceptance Criteria

* [ ] With a live (non-replay) game running, the app reads `displayTime` within
      ~1s accuracy and shows game status in the overlay.
* [ ] The build order JSON is loaded on game start and the correct steps are
      scheduled against `displayTime`.
* [ ] Each step is spoken ~`leadTimeSec` before its target time, in Chinese.
* [ ] Voice stops and state resets on game end; replays are ignored.
* [ ] Late connect skips already-passed steps and resumes from the next one.

## Definition of Done

* Tests for poll/parse (Rust) and cue-scheduling/lead-time logic (frontend).
* `npm run build` (tsc + vite) green; `cargo build` green.
* Follows `.trellis/spec/frontend/` and `.trellis/spec/tauri/` guidelines (typed
  `invoke`/events, capability for any new permission, immutable state, no `any`).
* New plugin permissions added to `src-tauri/capabilities/default.json` if needed.

## Out of Scope (MVP)

* Reading opponent build/units (API doesn't expose it; would be cheating).
* In-app build-order editor (hand-edit JSON for now).
* Multiple matchups / full race × race coverage (engine ready, data deferred).
* Importing builds from SCBox/liquipedia.
* Mobile / cross-device; non-macOS polish.

## Research References

* SC2 Client API `/game` (port 6119), verified 2026-06-06: exposes `displayTime`
  (in-game clock float), `isReplay` (bool), `players[]` with `race`/`name`/`result`.
  Localhost-only by default; port overridable via SC2 arg `-clientapi 127.0.0.1:6120`.
  Source: Blizzard s2protocol / s2client-api docs.

## Technical Notes

* `src-tauri/src/lib.rs` — register commands in `generate_handler!`; new plugins
  need a capability in `src-tauri/capabilities/default.json`.
* HTTP polling to 6119 lives in the Rust backend (reqwest or similar); results
  pushed to the frontend via Tauri `emit`/`listen` events.
* Web Speech API feasibility in WKWebView to be confirmed first thing in
  implementation; pre-recorded/native TTS is the fallback if quality is poor.
