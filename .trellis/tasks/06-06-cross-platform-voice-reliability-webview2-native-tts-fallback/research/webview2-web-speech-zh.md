# WebView2 Web Speech API — Chinese (zh-CN) Reliability Research

**Task:** `06-06-cross-platform-voice-reliability-webview2-native-tts-fallback`
**Question:** Is browser `window.speechSynthesis` (lang `zh-CN`) reliable enough on Windows WebView2 to ship to Chinese SC2 players, or is a native-TTS fallback required?
**Date:** 2026-06-06
**Note on sourcing:** Web search / Exa MCP tools were unavailable in this environment. Findings below reflect the documented, well-established behavior of Chromium / WebView2 / Windows SAPI and the W3C spec. Canonical source URLs are cited for verification; treat any specific percentage claims as directional, not measured.

---

## TL;DR

- `speechSynthesis` **works** in WebView2, but its voices come from the **OS (Windows SAPI / OneCore voices)** — not bundled with the runtime.
- A Windows machine **without a Chinese language pack / speech feature installed will have no usable zh-CN voice**, producing silence or wrong-language/English-accented output.
- The empty-`getVoices()`-on-first-call issue is real in Chromium/WebView2 and must be handled via the `voiceschanged` event.
- For a Chinese-targeted app on default Windows installs, **Web-Speech-only is NOT safe**. A native-TTS fallback is effectively required.

---

## 1. Does `speechSynthesis` work in WebView2, and does it expose zh-CN voices?

**Engine:** WebView2 is Chromium/Edge. On Windows, Chromium's `SpeechSynthesis` implementation is a **bridge to the OS speech engine** (Windows `Windows.Media.SpeechSynthesis` / SAPI5 / OneCore voices). It does **not** ship its own TTS voices.

Key consequences:

- **Voices are OS-provided.** `getVoices()` returns whatever voices Windows exposes for the current installed languages.
- **No Chinese language/speech feature → no zh-CN voice.** If the user has not installed the Chinese language pack *and* its speech component, `getVoices()` will contain no `zh-CN` voice. The default Microsoft Chinese voices (e.g. *Microsoft Huihui*, *Microsoft Yaoyao*, *Microsoft Kangkang*, plus newer *Xiaoxiao/Yunyang* OneCore voices) are only present when Chinese is added under **Settings → Time & Language → Language & region → (Chinese) → Language options → Speech**.
- **Behavior with no matching voice:** With only `utterance.lang = "zh-CN"` set and no zh-CN voice available, the engine falls back to a default (typically the system English voice). Reading Chinese characters through an English voice generally produces **garbled, partial, or no audio** — not correct Mandarin. So the practical outcome for an unconfigured machine is "broken," not "accented but understandable."
- **Headless/server-style Windows / Windows N/KN editions** can ship with *no* TTS voices at all; `getVoices()` may be empty entirely.

**Sources:**
- MDN `SpeechSynthesis.getVoices()` — voices are platform/OS provided: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- W3C Web Speech API spec (voices supplied by the user agent / platform): https://wicg.github.io/speech-api/
- Microsoft — install speech / text-to-speech languages on Windows: https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01
- WebView2 distributes the Edge/Chromium runtime, not OS voices: https://learn.microsoft.com/en-us/microsoft-edge/webview2/

---

## 2. The `getVoices()` async / `voiceschanged` timing issue

**Problem:** In Chromium (and therefore WebView2), the voice list is populated **asynchronously**. A synchronous `getVoices()` call early in page load frequently returns an **empty array**, because the list isn't ready yet. The list is signaled ready via the `voiceschanged` event on `speechSynthesis`. Firefox/Chrome historically differ; Chromium specifically tends to need the event.

**Robust pattern — await voices before speaking:**

```ts
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    // Fires (sometimes more than once) when the async list is ready.
    const onChange = () => {
      const v = synth.getVoices();
      if (v.length > 0) {
        synth.removeEventListener("voiceschanged", onChange);
        resolve(v);
      }
    };
    synth.addEventListener("voiceschanged", onChange);
    // Safety timeout: some engines never fire the event (already-loaded or none available).
    setTimeout(() => {
      synth.removeEventListener("voiceschanged", onChange);
      resolve(synth.getVoices()); // may be empty -> caller must handle "no voice"
    }, 1500);
  });
}
```

Notes / gotchas:
- `voiceschanged` can fire **zero, one, or multiple times** — don't assume exactly one. Always re-query `getVoices()` inside the handler.
- Always include a **timeout fallback**: if no voices ever load (e.g. no zh-CN installed), the event may never fire, so you must not block forever.
- After awaiting, **explicitly check whether a `zh-CN` voice exists**; do not just set `utterance.lang` and hope.
- A long-known Chromium bug: speech stops after ~15s of continuous utterance; for short build-order cues this is irrelevant, but keep utterances short.

**Sources:**
- MDN `getVoices()` (async population / `voiceschanged`): https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- MDN `voiceschanged` event: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event
- Chromium issue tracker (empty voice list / voiceschanged timing, ~15s cutoff): https://issues.chromium.org/ (search "speechSynthesis getVoices empty")

---

## 3. Likelihood a Chinese SC2 player has a usable zh-CN voice on default installs

**The decisive factor is whether Chinese was selected as a display/speech language during OS setup.**

- **Chinese-region Windows (zh-CN SKU / set up in Chinese):** Very likely to have at least one Chinese OneCore TTS voice present by default. This is the common case for players in mainland China who bought/installed a Chinese-language Windows.
- **English (or other) Windows where the user only reads Chinese / plays a Chinese SC2 client:** Likely to have **no** zh-CN speech voice, because speech components are installed per-language and aren't pulled in just by reading Chinese text or running a Chinese-locale game. This is a real and common configuration in the SC2 / esports community (English/global Windows installs + Chinese players).
- **Windows 10 vs 11:**
  - Windows 11 ships newer/higher-quality OneCore Chinese voices (Xiaoxiao, Yunxi, etc.) **when Chinese is installed**, and the "Speech" feature is an on-demand component.
  - On both 10 and 11, speech voices are **Features on Demand / language-pack gated**; neither version guarantees a zh-CN voice on a non-Chinese install.
  - Windows 10/11 **N and KN** editions, and trimmed/LTSC images popular with some gamers, can be missing media/speech components entirely.
- **No reliable hard percentage exists.** Community/developer reports consistently describe Web Speech zh voices as "present for some users, absent for others" — i.e. **not dependable** across an uncontrolled install base. Treat coverage as "good on Chinese-locale machines, poor-to-absent on everything else."

**Practical read for this audience (Chinese SC2 players, mostly Windows):** A meaningful fraction — especially those on English/global or trimmed Windows installs — will have **no usable zh-CN Web Speech voice**, and the app will be silent or wrong for them with no clear signal to the user.

**Sources:**
- Microsoft — supported languages & voices, speech is per-language install: https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01
- Microsoft — Features on Demand / language packs (speech component gating): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/features-on-demand-language-fod
- Windows N/KN editions lack Media Feature Pack (affects speech/media): https://support.microsoft.com/en-us/topic/media-feature-pack-list-for-windows-n-editions-c1c6fffa-d052-8338-7a79-a4bb980a700a

---

## 4. Practical verdict: Web-Speech-only vs native fallback

**Verdict: Web-Speech-only is NOT safe to ship to this audience. A native-TTS fallback is effectively required.**

Reasoning:
1. The audience is broad and uncontrolled (consumer Windows machines, many on English/global or trimmed installs).
2. zh-CN voices are OS-gated and **not guaranteed present**; absence yields silence or wrong-language output — a core-feature failure, since spoken build-order cues *are* the product.
3. The failure is **silent**: the app can't easily tell the user "you have no Chinese voice installed," so it just doesn't work for them.

### Recommendation

- **Keep Web Speech as the fast path**, but:
  1. After awaiting `voiceschanged`, **detect** whether a real `zh-CN` voice exists (don't rely on `lang` alone).
  2. If no zh-CN voice is present, **fall back to a native/bundled TTS path** so audio still works.
- **Native fallback options to evaluate (Tauri 2, Windows-first):**
  - **Bundled offline TTS via a Rust crate / sidecar** invoked through a Tauri command (e.g. a Piper-style neural TTS sidecar with a bundled Mandarin model) — fully self-contained, no OS voice dependency.
  - **Windows SAPI / `Windows.Media.SpeechSynthesis` directly from Rust** — still depends on an installed Chinese voice, so it does **not** solve the "no voice installed" case; only useful if you also detect and prompt to install.
  - **Pre-rendered audio clips** for the fixed/common cue vocabulary (build-order steps are a bounded phrase set) — most reliable and lowest-risk if the phrase set is small and mostly static.
- **Cross-platform note:** macOS WKWebView reliably ships zh-CN voices, so the fallback is primarily a **Windows concern**; gate the fallback behind a capability check rather than per-OS branching where possible.
- **Always** ship the robust `voiceschanged`-await + voice-presence check from §2 regardless of which fallback is chosen.

---

## Appendix — Key source URLs

- MDN `SpeechSynthesis.getVoices()`: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices
- MDN `voiceschanged` event: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event
- W3C Web Speech API: https://wicg.github.io/speech-api/
- Microsoft supported languages/voices: https://support.microsoft.com/en-us/windows/appendix-a-supported-languages-and-voices-4486e345-7730-53da-fcfe-55cc64300f01
- Microsoft Features on Demand (language/speech): https://learn.microsoft.com/en-us/windows-hardware/manufacture/desktop/features-on-demand-language-fod
- WebView2 docs: https://learn.microsoft.com/en-us/microsoft-edge/webview2/
- Piper TTS (candidate bundled offline engine): https://github.com/rhasspy/piper
