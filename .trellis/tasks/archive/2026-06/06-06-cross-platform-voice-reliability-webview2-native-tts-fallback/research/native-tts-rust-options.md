# Native TTS options for `scbox-app` (Tauri 2, Rust backend) — Chinese (zh-CN) voice cues

Research only. Goal: decide whether/how to add a native-TTS fallback (or primary path)
for speaking short Chinese build-order cues, because the WebView2 Web Speech API on
Windows may not expose zh-CN voices.

Context in this repo (today):
- `src/lib/speech.ts` is a thin Web Speech API wrapper: builds a `SpeechSynthesisUtterance`,
  sets `lang = "zh-CN"`, picks a voice via `synth.getVoices().find(v => v.lang === "zh-CN")`,
  else relies on the lang hint. Degrades to a no-op when unavailable.
- `src/hooks/useBuildOrderVoice.ts` calls `speak(step.say)` per due step; `cancelAll()` to stop.
- `src-tauri/Cargo.toml` has no TTS dependency yet (tauri 2, reqwest, tokio).

---

## 1. The Rust `tts` crate (`tts-rs`) and alternatives

**Crate:** `tts` v0.26.3 — "High-level Text-To-Speech (TTS) interface".
- Repo: https://github.com/ndarilek/tts-rs
- Docs: https://docs.rs/tts
- crates.io: https://crates.io/crates/tts

### Backends (confirmed from the crate's `Cargo.toml` per-target deps + `src/backends/`)
| Platform | Backend | Underlying API | Source file |
|---|---|---|---|
| Windows | WinRT (default) | `windows` crate `Media_SpeechSynthesis` (`SpeechSynthesizer`, `VoiceInformation`) | `backends/winrt.rs` |
| Windows | Screen reader/SAPI via **Tolk** (opt-in `tolk` feature) | Tolk → SAPI/screen readers | `backends/tolk.rs` |
| macOS 10.14+ / iOS | AVFoundation (`AVSpeechSynthesizer`) | `objc` + `cocoa-foundation` | `backends/av_foundation.rs` |
| macOS ≤10.13 | AppKit (`NSSpeechSynthesizer`) | `objc` | `backends/appkit.rs` |
| Linux | Speech Dispatcher (`speechd`) | `speech-dispatcher` 0.16 | `backends/speech_dispatcher.rs` |
| Android | Android TTS via JNI | `jni`, `ndk-context` | `backends/android.rs` |
| Web (wasm32) | Web Speech API | `web-sys` `SpeechSynthesis*` | `backends/web.rs` |

So on Windows it is **WinRT by default**, NOT raw SAPI5. SAPI is only reached via the
optional `tolk` feature (intended for screen-reader integration, not general synthesis).

### Chinese voice support / how it picks a voice/language
- `Voice` exposes `id()`, `name()`, `gender()`, and `language() -> oxilangtag::LanguageTag<String>`
  (`src/lib.rs`). Language tags come from the OS:
  - WinRT: `VoiceInformation.Language()` → parsed as a BCP-47 LanguageTag (`backends/winrt.rs`,
    `SpeechSynthesizer::AllVoices()` / `DefaultVoice()`).
  - AVFoundation: reads each voice's `language` selector and parses it (`backends/av_foundation.rs`).
- **There is no "speak in language X" call.** You enumerate `tts.voices()`, filter for one whose
  `language()` starts with `zh`, call `tts.set_voice(&voice)`, then `tts.speak(text, interrupt)`.
  If no zh voice exists on the machine, the crate cannot synthesize Chinese — it will fall back to
  the default (likely English) voice. This is the same limitation as Web Speech.
- Whether a zh voice appears depends entirely on what voices the OS has installed (see §3).

### Public API sketch (from `tts-0.26.3/src/lib.rs`)
```rust
use tts::{Tts, Features};

let mut tts = Tts::default()?;             // picks the platform default backend
let feats: Features = tts.supported_features();

// Enumerate + pick a Chinese voice if present
if feats.voice {
    if let Some(zh) = tts.voices()?.into_iter()
        .find(|v| v.language().primary_language().starts_with("zh"))
    {
        tts.set_voice(&zh)?;
    }
}

if feats.rate { let _ = tts.set_rate(tts.normal_rate()); }
tts.speak("补两个农民", /* interrupt = */ true)?;   // interrupt=true ≈ cancelAll()+speak
tts.stop()?;                                          // ≈ cancelAll()
```
Other methods: `set_rate/pitch/volume` (+ `min_/max_/normal_`), `is_speaking()`,
`on_utterance_begin/end/stop` callbacks. Feature availability varies per backend — always
gate on `supported_features()`.

### Maturity / async
- Mature, widely used in the accessibility ecosystem (author maintains screen-reader tooling).
  Multi-platform, actively maintained, MIT licensed.
- **Not async.** The API is synchronous; speech runs on the platform's own audio thread, so
  `speak()` returns quickly (it queues) rather than blocking until audio finishes. Completion is
  observed via the `on_utterance_*` callbacks, not a `Future`.

### ⚠️ Tauri-specific gotchas (important)
- **`Tts` is `!Send`/`!Sync`.** It's defined as `pub struct Tts(Rc<RwLock<Box<dyn Backend>>>)`
  (`src/lib.rs`). `Rc` means it cannot be moved across threads or stored in Tauri's `State`
  (which requires `Send + Sync`), and cannot be held across an `.await` in an async command.
  - Implication: do **not** put a long-lived `Tts` in `app.manage(...)`. Either
    (a) construct a fresh `Tts` inside a **synchronous** `#[tauri::command]` per call, or
    (b) own it on a dedicated OS thread and drive it via a channel (`std::sync::mpsc`).
- **Windows WinRT requires an initialized apartment / message loop.** WinRT
  `SpeechSynthesizer` + media playback expect COM/WinRT init and event pumping. Tauri's main
  thread already runs a Windows message loop; running `tts` on a worker thread may need explicit
  `windows` runtime init. Construct-per-command on a thread that pumps messages is the safest.
- macOS: `AVSpeechSynthesizer` wants to live with a run loop; in practice constructing inside a
  command works because the app already has one, but keep the instance off `await` points.

### Alternatives to `tts` crate
- **`msedge-tts`** (v0.4.0, https://crates.io/crates/msedge-tts): wraps Microsoft Edge's online
  "Read aloud" service over WebSocket. Pros: excellent neural zh-CN voices
  (e.g. `zh-CN-XiaoxiaoNeural`) regardless of what's installed locally; SSML; rate/pitch control.
  **Cons: requires internet** (unofficial endpoint, may break, ToS/latency concerns). Good as an
  optional "high quality online" tier, not a reliable offline fallback.
- **`say` crate / shelling out** to OS tools (see §2) — lowest dependency weight.
- **Local neural TTS** (`sherpa-onnx` v1.13.x, `any-tts`, `qwen3_tts`): fully offline,
  high quality, but ships large model files (tens–hundreds of MB) and adds startup/inference
  latency — overkill for short cues and bloats the installer. Not recommended for v1.

---

## 2. OS-built-in options without a crate

Invoke the OS synthesizer as a subprocess from Rust (`std::process::Command` /
`tokio::process::Command`). No extra Rust deps; trades a process spawn (tens of ms) for simplicity.

### Windows — SAPI / WinRT via PowerShell
- **Classic SAPI (`System.Speech`)**, present on all desktop Windows:
  ```powershell
  Add-Type -AssemblyName System.Speech
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoiceByHints('NotSet','NotSet',0, [System.Globalization.CultureInfo]'zh-CN')
  $s.Speak('补两个农民')
  ```
  or via the COM `SpVoice` object (`New-Object -ComObject SAPI.SpVoice`).
- **WinRT (`Windows.Media.SpeechSynthesis`)** is the modern API but is what the `tts` crate already
  wraps in Rust — no reason to shell out to it.
- Trade-offs: PowerShell startup adds ~100–300 ms cold; SAPI's `SelectVoiceByHints`/`SelectVoice`
  only works if a matching zh-CN voice is installed (see §3). On modern Windows the desktop SAPI
  voice list and the WinRT/Settings voice list can differ — a "Settings → Speech" voice may be a
  WinRT/mobile voice not visible to `System.Speech`, which is a classic source of "voice exists in
  Settings but SAPI can't find it" bugs. Prefer the WinRT path (the `tts` crate) on Windows.

### macOS — `say`
```bash
say -v Tingting "补两个农民"     # Tingting is the bundled zh-CN voice
say -v "?"                       # list installed voices
```
- Pros: always available, no deps, `-v` selects a Chinese voice, `-r` sets rate.
- Cons: a Chinese voice (e.g. Ting-Ting/Tingting) may need to be enabled/downloaded in
  System Settings → Accessibility → Spoken Content → System Voice on some machines.

### Linux — `espeak-ng` (or `spd-say`)
```bash
espeak-ng -v cmn "补两个农民"     # cmn = Mandarin
spd-say -l zh "补两个农民"        # via speech-dispatcher (what the tts crate uses)
```
- Pros: tiny, offline. Cons: must be installed (`apt install espeak-ng`); robotic Mandarin
  quality; you'd ship a runtime dependency or document it. Linux is "nice to have" here.

### Trade-offs summary (subprocess approach)
| | Latency | Ship deps? | Chinese availability |
|---|---|---|---|
| Win PowerShell SAPI | cold spawn ~100–300ms | none (built in) | needs zh voice installed; SAPI vs WinRT voice-list mismatch risk |
| macOS `say` | ~30–80ms | none | bundled (Tingting), may need enabling |
| Linux `espeak-ng` | low | must install | offline but robotic |

---

## 3. Is a Chinese voice present on a default Windows install?

Short answer: **usually not until the zh-CN language pack / language features are installed**,
and the same gap affects Web Speech.

- Windows ships only the voices for the **OS display language / installed languages**. On a
  default **English (US)** Windows 10/11 install you get David/Zira (en-US) only — **no Chinese
  voice**. Microsoft's Mandarin voices (desktop **Huihui** (zh-CN), and the modern
  **Microsoft Xiaoxiao/Yunyang/etc.** neural-style WinRT voices) appear only after the user adds
  Chinese as a language and installs the optional **Speech** language feature:
  Settings → Time & Language → Language & region → add 中文(简体) → Language options →
  Install **Speech**. (Older naming: "Microsoft Huihui Desktop", "Microsoft Yaoyao".)
  - Refs:
    - Microsoft Learn — Appendix A: Supported languages and voices (lists zh-CN voices such as
      Microsoft Huihui): https://learn.microsoft.com/windows-hardware/customize/desktop/supported-languages-and-voices
    - Add a Windows display/speech language:
      https://support.microsoft.com/windows/manage-display-language-and-region-settings-in-windows
    - WinRT `SpeechSynthesizer.AllVoices` (only enumerates installed voices):
      https://learn.microsoft.com/uwp/api/windows.media.speechsynthesis.speechsynthesizer.allvoices
- On a **Chinese-language Windows install** (the realistic case for most Chinese SC2 players),
  a zh-CN voice is present out of the box. So the worst case is an English-locale machine.
- **Web Speech in WebView2 draws from the same OS voice pool.** WebView2 (Chromium/Edge) routes
  `speechSynthesis.getVoices()` to the platform speech engine; on Windows that's the same
  SAPI/OneCore voices. Therefore:
  - If the OS has no zh-CN voice → **both** Web Speech and the `tts` crate's WinRT backend will
    fail to produce Chinese (they degrade to a default voice or no zh match). A native fallback
    does **not** magically add a Chinese voice; it only changes *how* you reach the same voices.
  - WebView2-specific wrinkle: voice list can be empty until the `voiceschanged` event fires, and
    historically some WebView2 builds exposed fewer voices than the OS. The current
    `pickVoice()` in `speech.ts` reads `getVoices()` once — if called before voices load it returns
    `null`. (Documenting only; not a recommendation.)
  - Comparison verdict: the **availability problem is the same** for Web Speech and native; the
    value of a native path is mainly (a) more reliable enumeration/selection and (b) consistent
    cross-platform behavior, not access to extra Chinese voices on a bare English install.

References on WebView2/Web Speech voice availability:
- MDN `SpeechSynthesis.getVoices()` (driven by OS voices; async via `voiceschanged`):
  https://developer.mozilla.org/docs/Web/API/SpeechSynthesis/getVoices
- WebView2 known issues / platform speech dependence:
  https://learn.microsoft.com/microsoft-edge/webview2/

---

## 4. Recommended architecture for THIS app

### Recommendation
Adopt a **layered voice abstraction with graceful fallback**, keeping Web Speech as the primary
path and adding a Rust native command as the fallback. Do **not** go native-only.

```
speakCue(text):
  1. Web Speech: if speechSynthesis exists AND a zh-CN voice is present → use it (current path).
  2. else → invoke Tauri command `speak_tts(text, lang="zh-CN")` (tts crate / WinRT, AVFoundation).
  3. else (no engine / no zh voice anywhere) → current no-op + surface a one-time UI hint
     ("install a Chinese voice / language pack for spoken cues").
```

Rationale:
- Web Speech already works and is zero-dependency where voices exist (esp. Chinese-locale Windows
  and macOS). Keep it as tier 1.
- The native tier handles WebView2 enumeration quirks and gives one consistent code path on
  Windows/macOS. Because §3 shows neither tier conjures a missing zh voice, tier 3 (user guidance)
  is the real reliability backstop — make it explicit.
- `msedge-tts` (online neural zh-CN) can be an **optional** quality upgrade tier later, gated
  behind a setting, since this app already depends on `reqwest`/network. Not a default offline path.

### Suggested Rust command shape (sync command to respect `tts` being `!Send`)
```rust
// src-tauri: synchronous command (Tts is !Send, so no async/await, no managed State)
#[tauri::command]
fn speak_tts(text: String, lang: String) -> Result<(), String> {
    use tts::Tts;
    let mut tts = Tts::default().map_err(|e| e.to_string())?;
    if tts.supported_features().voice {
        if let Ok(voices) = tts.voices() {
            if let Some(v) = voices.into_iter()
                .find(|v| v.language().primary_language().starts_with(&lang[..2])) {
                let _ = tts.set_voice(&v);
            }
        }
    }
    tts.speak(text, /* interrupt = */ true).map(|_| ()).map_err(|e| e.to_string())
}

#[tauri::command]
fn stop_tts() -> Result<(), String> { /* construct or signal a worker to stop() */ Ok(()) }

// list voices so the frontend can decide whether a zh voice exists at all
#[tauri::command]
fn list_voices() -> Result<Vec<(String, String, String)>, String> { /* (id, name, lang) */ }
```
Frontend (`src/lib/speech.ts`) gains an internal `speakNative(text)` that calls
`invoke("speak_tts", { text, lang: "zh-CN" })` and is used only when the Web Speech tier can't
find a zh-CN voice. `cancelAll()` would also call `invoke("stop_tts")`.

Cargo addition: `tts = "0.26"` (default WinRT on Windows; no `tolk` feature needed).

### What's verifiable in CI/tests vs. needs a real Windows machine
**Verifiable in CI / unit tests (no audio):**
- Frontend tier-selection logic: given a mocked `speechSynthesis.getVoices()` returning/omitting a
  zh-CN voice, assert it chooses Web Speech vs. `invoke("speak_tts")` vs. no-op. (jsdom + mocked
  `window.speechSynthesis` and a mocked Tauri `invoke`.)
- `tts` crate **compiles** for each target (`cargo check --target x86_64-pc-windows-msvc`,
  `aarch64-apple-darwin`) — catches the WinRT/`windows`-crate feature wiring.
- Command contract: `speak_tts`/`list_voices` signatures, error mapping to `Result<_, String>`,
  language-prefix matching helper (`"zh-CN" → "zh"`), are pure and unit-testable.
- Guard against the `!Send` regression: a test/asserting the command stays **synchronous** (no
  `async` + `State<Tts>`), or a `static_assertions` note. (`Tts: !Send` is documented above.)

**Needs a real machine (manual / non-CI):**
- That a zh-CN voice is actually enumerated and produces audible Chinese — depends on installed
  voices; headless CI usually has none. Verify on: (a) Chinese-locale Windows, (b) English Windows
  + zh Speech pack, (c) English Windows with **no** zh voice (confirms graceful tier-3 hint),
  (d) macOS with/without Tingting enabled.
- Latency of the native path (WinRT init, PowerShell cold start if that route is chosen).
- WebView2 `voiceschanged` timing (whether `getVoices()` is empty on first paint).

---

## Sources
- `tts` crate: https://crates.io/crates/tts · https://docs.rs/tts · https://github.com/ndarilek/tts-rs
  (per-target deps and backends confirmed from local `tts-0.26.3/Cargo.toml` & `src/backends/`)
- `windows` crate `Media_SpeechSynthesis`: https://learn.microsoft.com/uwp/api/windows.media.speechsynthesis.speechsynthesizer.allvoices
- `msedge-tts`: https://crates.io/crates/msedge-tts
- `sherpa-onnx`: https://crates.io/crates/sherpa-onnx
- Windows supported languages/voices (incl. zh-CN Huihui): https://learn.microsoft.com/windows-hardware/customize/desktop/supported-languages-and-voices
- Add Windows display/speech language: https://support.microsoft.com/windows/manage-display-language-and-region-settings-in-windows
- macOS `say` man page: https://ss64.com/osx/say.html
- `espeak-ng`: https://github.com/espeak-ng/espeak-ng
- MDN `SpeechSynthesis.getVoices`: https://developer.mozilla.org/docs/Web/API/SpeechSynthesis/getVoices
- WebView2 docs: https://learn.microsoft.com/microsoft-edge/webview2/
