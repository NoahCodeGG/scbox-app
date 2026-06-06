# Auto-select build order by matchup (identify me + opponent race)

## Goal

Today the app guides with `builds[0]` (`pickActiveBuild` just takes the first
loaded build). Make it **automatically pick the build matching the current
matchup**: at game start, identify which player is "me" and read the opponent's
race, then select the build order whose matchup targets that race. This is what
makes the assistant usable across PvT/PvZ/PvP-style games without manual
switching. Builds on #1's multi-file `load_build_orders` (already returns ALL
builds) and a configured player name.

## Background (existing code)
- `GameSnapshot.players: PlayerInfo[]` where `PlayerInfo = { id, name, type, race, result }`. `race` is a short code: `"Terr" | "Prot" | "Zerg" | "random"` (see `src/lib/format.ts` raceLabel map). `type` is `"user" | "computer"`.
- `BuildOrder = { matchup: string; race: string; leadTimeSec; steps }`. The shipped example has `matchup: "TvX"`, `race: "Terran"`.
- `pickActiveBuild(builds)` currently returns `builds[0]`. `useBuildOrders` loads all builds from the app-data dir.
- No player-name config exists yet. No settings storage exists yet.

## Decision (locked, autonomous)

| Topic | Decision |
|-------|----------|
| Matchup convention | Build `matchup` uses the form `"<MyRace>v<OppRace>"` with race letters `T/P/Z` and `X` = any. Examples: `"TvP"`, `"TvZ"`, `"TvT"`, `"TvX"` (catch-all). |
| Identify "me" | A configured **player name** (exact match against `PlayerInfo.name`). If unset or no match, fall back: in a 1v1 with one `type:"user"` and one `type:"computer"`, "me" = the user; otherwise "me" = `players[0]` and surface a hint to set the name. |
| Opponent | The other player in a 2-player game. (3+ players / FFA is out of scope — use `TvX`/first build.) |
| Race codes | Map `Terr→T, Prot→P, Zerg→Z`. Opponent `random` → treated as `X` (no specific race known at load). |
| Selection rule | Among loaded builds whose race-letter == my race, choose the one whose matchup opponent-letter == opponent's letter; if none, fall back to a `...vX` catch-all for my race; if still none, `builds[0]`; if no builds, the bundled fallback. Pure, testable. |
| Config storage | A small JSON settings file in the app-data dir via Rust commands `load_settings`/`save_settings` (mirrors the #1 builds IO pattern). MVP setting: `{ playerName: string }`. |
| Re-selection timing | Re-pick at each game start (matchup known once players appear), consistent with the existing reload-on-game-start. |

## Requirements
* R1: Pure `selectBuild(builds, myRaceLetter, oppRaceLetter) -> BuildOrder | null`
  implementing the selection rule above; fully unit-tested.
* R2: Pure `identifyMatchup(players, playerName) -> { meId, myRace, oppRace } | null`
  (race letters; null when it can't be determined, e.g. <2 players). Unit-tested,
  incl. the name-match, user-vs-computer fallback, and `random` opponent cases.
* R3: Rust `load_settings()`/`save_settings(settings)` commands (app-data JSON,
  seed empty default), registered in `generate_handler!`; `Settings { playerName }`
  serde shape ⇄ TS type.
* R4: `App.tsx` uses the configured name + the current snapshot to pick the active
  build at game start; falls back gracefully and shows which matchup/build is active.
* R5: A minimal settings input for `playerName` (a small field in the overlay or a
  tiny settings affordance) that persists via `save_settings`. (Full settings panel
  is task #5 — keep this minimal, just the player name.)

## Acceptance Criteria
* [ ] `selectBuild` unit tests: exact matchup wins; `vX` catch-all fallback; race
      mismatch excluded; empty → null.
* [ ] `identifyMatchup` unit tests: name match; user/computer fallback; `random`
      opponent → X; <2 players → null.
* [ ] Rust `load_settings`/`save_settings` round-trip + seed default, with tests;
      registered; `Settings` serde ⇄ TS aligned.
* [ ] At game start the active build reflects the detected matchup; overlay shows
      the active matchup/build name.
* [ ] Player name persists across restarts (written to app-data settings).
* [ ] `cargo test`, `tsc`, `pnpm build`, `pnpm test` green.

## Out of Scope
* Full settings panel / lead-time / port / voice settings (task #5).
* In-app build editor (#7); FFA / team games; mirror-specific sub-variants.
* Changing how builds are stored on disk (reuse #1's `builds/` dir).

## Definition of Done
* Follows `.trellis/spec/tauri/*` (command/invoke contract synced, Result<T,E>,
  no needless capability) and `.trellis/spec/frontend/*` (typed invoke, immutable
  state, no any, pure selection logic separated + tested).
* Cross-layer: `Settings` Rust serde shape ⇄ TS type aligned.

## Technical Notes
* Reuse the #1 file-IO pattern for settings (`builds.rs` is the template; consider
  `src-tauri/src/settings.rs`). Don't trust on-disk content — validate.
* Race-letter mapping belongs in a pure helper (extend `src/lib/format.ts` or a new
  `src/lib/matchup.ts`). `selectBuild`/`identifyMatchup` in `src/lib/matchup.ts`.
* The shipped example build's matchup `"TvX"` already acts as a catch-all for
  Terran — keep it working as the fallback while the user adds matchup-specific files.
