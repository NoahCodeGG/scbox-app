# Cross-platform voice reliability (WebView2 + native TTS fallback)

## Goal

The app speaks build-order cues via the browser Web Speech API. That works on
macOS (WKWebView) but is **unreliable on Windows (WebView2)** for the target
audience (Chinese SC2 players): both Web Speech and any native engine pull from
the same OS voice pool, and a Windows machine without the Chinese **Speech**
language feature has no usable zh-CN voice — the app then goes silent or reads
garbled output, with no signal to the user. Make voice reliable and, crucially,
make failure **visible and actionable**.

## Key research findings (see Research References)
- WebView2 `speechSynthesis` and the Rust `tts` crate (WinRT backend) both read
  the **same OS voices**. A native fallback does NOT conjure a missing zh-CN
  voice — it only gives more reliable enumeration/selection and one consistent
  code path.
- `getVoices()` is async in Chromium/WebView2: empty on first call until
  `voiceschanged` fires (with a timeout fallback).
- Therefore the real reliability backstop is **tier 3: detect "no zh-CN voice
  anywhere" and tell the user to install the Chinese speech pack**.

## Decision (locked, 2026-06-06): layered fallback
```
speakCue(text):
  1. Web Speech: speechSynthesis exists AND a real zh-CN voice is present → use it.
  2. else → invoke Rust `speak_tts(text, lang="zh-CN")` (tts crate; WinRT / AVFoundation).
  3. else (no zh-CN voice on the machine at all) → no audio + a one-time, visible
     hint: "未检测到中文语音，请在系统中安装中文语音包以启用语音播报" + how-to link.
```
NOT chosen: bundled offline neural TTS (installer bloat), pre-recorded clips
(conflicts with free-text build orders). These remain future options.

## Hard constraints (from research)
- `tts::Tts` is `!Send`/`!Sync` (holds an `Rc`). The `speak_tts`/`stop_tts`
  commands MUST be **synchronous** `#[tauri::command]`s — do NOT store `Tts` in
  `app.manage()`/`State`, do NOT hold it across `.await`. Construct per call
  (or own it on a dedicated thread via a channel).
- `tts = "0.26"`, default features (WinRT on Windows; no `tolk`). Adds the
  `windows` crate transitively — must still `cargo build` on macOS for dev.
- macOS WKWebView reliably has zh-CN voices, so the fallback is mainly a Windows
  concern; gate on capability (no zh-CN voice), not on `cfg!(windows)`.

## Requirements
* R1: Robust voice loading in `speech.ts` — await `voiceschanged` (with ~1.5s
  timeout), then **explicitly check for a zh-CN voice** rather than trusting the
  `lang` hint alone.
* R2: A pure tier-selection function: given (web-speech available?, zh-CN web
  voice present?, native available?) → returns `"web" | "native" | "none"`.
* R3: Rust `speak_tts(text, lang) -> Result<(), String>` and `stop_tts() ->
  Result<(), String>` (synchronous), registered in `generate_handler!`; pick a
  voice whose language starts with `lang[..2]`. Plus `list_voices() ->
  Result<Vec<VoiceInfo>, String>` so the frontend can know if any zh-CN voice
  exists natively.
* R4: `speak()`/`cancelAll()` route through the tiers; `cancelAll()` also calls
  `stop_tts` when the native tier is active.
* R5: Tier 3 surfaces a visible, dismissible hint in the overlay (once), with
  guidance to install the Chinese speech pack. Never crash; never silently fail.

## Acceptance Criteria
* [ ] Pure tier-selection function unit-tested (web / native / none paths).
* [ ] `loadVoices` awaits `voiceschanged` and resolves on timeout (tested with a
      mocked `speechSynthesis`).
* [ ] zh-CN voice presence is checked explicitly (mock: voices with/without zh-CN).
* [ ] Rust `speak_tts`/`stop_tts`/`list_voices` compile and are registered; the
      language-prefix match helper is unit-tested; commands stay synchronous.
* [ ] When no zh-CN voice exists on any tier, the overlay shows the install hint
      and no exception is thrown.
* [ ] `cargo build`/`cargo test`, `tsc`, `pnpm build`, `pnpm test` all green.

## Out of Scope
* Bundled offline neural TTS (Piper/sherpa) and pre-recorded clips (future).
* Online neural TTS (`msedge-tts`) quality tier (future, behind a setting).
* Auto-installing the Windows speech pack (we only guide the user).

## Definition of Done
* Follows `.trellis/spec/tauri/*` (sync command contract, Result<T,E>, capability
  if a plugin is added — `tts` needs none) and `.trellis/spec/frontend/*`.
* Cross-layer contract: `VoiceInfo` Rust serde shape ⇄ TS type aligned.

## Manual verification needed (cannot run in CI / on this macOS box)
* Windows: (a) Chinese-locale → Web Speech works; (b) English Windows + zh
  Speech pack → native tier produces Chinese; (c) English Windows, NO zh voice →
  tier-3 hint shows and nothing crashes. macOS: zh voice present (Tingting).
* The user (distribution target is Windows) must run these on a real Windows box.

## Research References
* [`research/webview2-web-speech-zh.md`](research/webview2-web-speech-zh.md) —
  WebView2 zh-CN voices are OS-gated; Web-Speech-only is unsafe for this audience.
* [`research/native-tts-rust-options.md`](research/native-tts-rust-options.md) —
  `tts` crate covers Win(WinRT)/macOS/Linux but needs an installed zh voice;
  `Tts` is `!Send` (sync command); layered fallback + user hint recommended.

## Implementation Plan (small PRs)
* PR1 (Rust): add `tts` dep; `src-tauri/src/tts.rs` with sync `speak_tts`,
  `stop_tts`, `list_voices` + `VoiceInfo` serde + lang-prefix helper unit test;
  register handlers.
* PR2 (Frontend): rework `src/lib/speech.ts` (await voices, zh-CN detection,
  pure tier selection + tests); route `speak`/`cancelAll` through tiers calling
  `invoke`; tier-3 install hint UI in `App.tsx` (+ a `useVoiceCapability` hook).
