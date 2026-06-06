# Voice queue and debounce

## Goal

Prevent build-order TTS cues from overlapping, clobbering, or playing stale when
multiple steps come due close together (lag spike, tab-away, tightly-spaced
build steps). Serialize cues through one freshness-gated queue so they play in
order, drop genuinely-stale ones, and clear cleanly on game end/restart.

## What I already know

- `src/lib/speech.ts` `speak(text, rate)` fires immediately per call:
  - **web tier**: `synth.speak(utterance)` — Web Speech has its OWN internal FIFO queue, so calls play sequentially (no overlap), but a bunched backlog plays late/stale.
  - **native tier**: `invoke("speak_tts", …)` fire-and-forget.
- `src-tauri/src/tts.rs` `speak_tts`: constructs a FRESH `Tts` per call, calls `tts.speak(text, true)` (**interrupt = true**), and drops the engine before returning. So bunched native cues **cancel each other → only the last is heard (漏播)**, and rapid construct/interrupt/drop can cut utterances (叠播). `Tts` is `!Send`/`!Sync` (cannot be `manage()`d or held across `.await`) — a persistent native queue is hard.
- `cancelAll()` calls `synth.cancel()` + (native) `stop_tts`.
- `useBuildOrderVoice` already: dedups via `spokenGuardRef` (no double-speak of an index), suppresses late-connect backlog via `initialSpokenSet`, and on game end/replay/result calls `cancelAll()` + resets. It loops over due steps calling `speak()` for each — this is where bunching enters.
- macOS uses the web tier (verified); native is the Windows fallback (verification deferred).

## Decisions

- **(Q1) Coalescing = sequential FIFO + drop-stale.** One queue, played in order; a cue is dropped if it has waited longer than a freshness window (default 3000ms) before it starts — stale instructions are skipped, timely ones still play.
- **(Q2) Native scope = B (also fix Rust).** Replace the per-call construct/`interrupt=true`/drop pattern with a persistent TTS worker thread owning the `!Send` `Tts`, fed by an `mpsc` channel; speak with `interrupt=false` so cues queue instead of clobbering. RISK ACCEPTED: the native path runs only on Windows (macOS uses the web tier), so the Rust change ships unverified until the deferred Windows sweep; the web path is fully fixed + verifiable on macOS now.

## Requirements

- A single serialized cue queue in `lib/speech.ts`, one cue at a time, drop-stale (freshness window) before each cue starts.
  - web tier: advance on the utterance's `onend`/`onerror`.
  - native tier: advance on an estimated-duration timer (text-length based) so cues are paced (the persistent Rust engine also queues with `interrupt=false`, so no clobber even if the estimate is loose).
- `cancelAll()` clears the queue, stops the current utterance (`synth.cancel()`), and sends `stop_tts` — game end/restart/replay → immediate silence, no stale backlog.
- Existing dedup (`spokenGuardRef`) and late-connect suppression (`initialSpokenSet`) preserved; `useBuildOrderVoice` keeps calling `speak()` per due step (now enqueues).
- Rust: persistent TTS worker (one long-lived `Tts`), `speak_tts`/`stop_tts` become channel sends; `interrupt=false`.

## Acceptance Criteria

- [ ] Several cues becoming due together play sequentially in order, not overlapping.
- [ ] A cue whose start is delayed beyond the freshness window is dropped (not played late).
- [ ] `cancelAll()` empties the queue and silences current speech (verified via the pure queue tests + on game end/replay).
- [ ] Native cues no longer clobber each other: the Rust worker speaks with `interrupt=false` from one persistent engine (code-verified; runtime is Windows-only/deferred).
- [ ] The `speak_tts`/`stop_tts` invoke contract is unchanged for the frontend (`{ text, lang }` / no args).
- [ ] tsc / vitest / cargo green; `src/hooks/**` coverage gate held.

## Technical Approach

- **Frontend `lib/speech.ts`**:
  - Extract a pure, testable queue core that takes injected deps `{ now(): number, speakOne(cue): Promise<void> }` and holds the FIFO + drop-stale logic (`FRESHNESS_MS = 3000`). Unit-test ordering, drop-stale, and clear with fake timers + a mock `speakOne`.
  - `speak(text, rate)` enqueues `{ text, rate, enqueuedAt: now() }` and kicks the pump; still returns the resolved tier.
  - `speakOne` wrapper: web → build the utterance, resolve on `onend`/`onerror`; native → `invoke("speak_tts", { text, lang })` then resolve after `estimateDurationMs(text)` (base + per-char ms, clamped).
  - `cancelAll()` clears the queue + sets pump idle + `synth.cancel()` + `invoke("stop_tts")`.
- **Rust `tts.rs` + `lib.rs`**:
  - `enum TtsCommand { Speak { text: String, lang: String }, Stop }`.
  - `spawn_tts_worker() -> mpsc::Sender<TtsCommand>`: spawns a thread that constructs one `Tts`, keeps it alive, and loops `recv()`: on `Speak` set the matching voice for `lang` (best-effort) then `tts.speak(text, false)`; on `Stop` `tts.stop()`. The `!Send` `Tts` never leaves this thread; only the `Sender` (Send+Sync) is stored.
  - `TtsHandle(mpsc::Sender<TtsCommand>)` via `app.manage()`; `speak_tts`/`stop_tts` become `State<TtsHandle>` + `send(...)` (return `Result<(), String>`). `list_voices` stays a one-shot temp `Tts` (enumeration only).
  - `lib.rs setup`: spawn the worker and manage the handle.
- **Cross-layer**: the frontend `invoke("speak_tts", { text, lang })` / `invoke("stop_tts")` calls are unchanged; the `State` is injected on the Rust side (not a frontend arg).

## Implementation Plan (small PRs / phases)

- **PR1 (Rust)**: persistent TTS worker thread + `TtsHandle` state + rewire `speak_tts`/`stop_tts` to channel sends (`interrupt=false`); keep `list_voices`; `lib.rs` spawn/manage. cargo builds; keep `lang_matches` tests.
- **PR2 (Frontend)**: testable queue core in `lib/speech.ts` + drop-stale + tier-aware `speakOne` + `cancelAll` clears; `speak()` enqueues. Unit tests for the queue. macOS run-through (web tier).

## Out of Scope (explicit)

- Per-utterance native completion events / run-loop callbacks (kept out to avoid platform fragility; estimated-duration pacing instead).
- Reworking tier selection or voice enumeration.
- Windows real-machine verification of the native worker (deferred to the Windows sweep).

## Technical Notes

- Keep the queue core pure (inject clock + speaker) so it's unit-testable without a DOM; the DOM/`invoke` bits live in thin wrappers.
- `Tts` is `!Send`/`!Sync`: it must stay on the worker thread and never be `manage()`d or held across `.await` (only the `Sender` is shared).
