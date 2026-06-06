// Layered voice output for build-order cues with graceful fallback.
//
// Tiers (locked design):
//   1. "web"    Web Speech API when speechSynthesis exists AND a real zh-CN
//               voice is present.
//   2. "native" Rust `speak_tts` command (tts crate; WinRT / AVFoundation),
//               used when the web tier has no zh-CN voice but the OS exposes a
//               native zh-CN voice.
//   3. "none"   No zh-CN voice anywhere → no audio; the UI surfaces a one-time
//               hint to install the Chinese speech pack.
//
// Web Speech voices come from the same OS voice pool as the native engine, so
// the native tier does not conjure a missing zh-CN voice — it only gives more
// reliable enumeration. Tier 3 is the real reliability backstop.

import { invoke } from "@tauri-apps/api/core";

const SPEECH_LANG = "zh-CN";
const ZH_PRIMARY = "zh";
/** Max time to wait for the async `voiceschanged` population (ms). */
const VOICES_TIMEOUT_MS = 1500;

/** Usable Web Speech utterance rate bounds (per the Web Speech spec). */
const MIN_RATE = 0.5;
const MAX_RATE = 2.0;
const DEFAULT_RATE = 1.0;

/** Clamp an utterance rate into the usable range; non-finite falls back to 1.0. */
function clampRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_RATE;
  return Math.min(MAX_RATE, Math.max(MIN_RATE, rate));
}

/** Which output path `speak` will use. Resolved once by `initVoice`. */
export type VoiceTier = "web" | "native" | "none";

/**
 * One installed native voice. Cross-layer contract: mirrors the Rust
 * `VoiceInfo` struct in `src-tauri/src/tts.rs` (single-word field names map
 * 1:1 to the serialized JSON keys).
 */
export interface VoiceInfo {
  id: string;
  name: string;
  lang: string;
}

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

/** Whether a language tag is Chinese (matches on the primary subtag). */
function isZhLang(lang: string): boolean {
  return lang.toLowerCase().startsWith(ZH_PRIMARY);
}

/** Explicit zh-CN presence check across a web voice list. */
export function hasZhVoice(voices: ReadonlyArray<SpeechSynthesisVoice>): boolean {
  return voices.some((v) => isZhLang(v.lang));
}

/**
 * Resolve the available web voices, awaiting the async `voiceschanged` event
 * (Chromium/WebView2 returns an empty list on the first synchronous call) with
 * a timeout so a machine that never fires the event can't block forever.
 *
 * Resolves with whatever `getVoices()` returns at that point — possibly empty;
 * the caller must handle "no voice".
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const synth = getSynth();
  if (!synth) return Promise.resolve([]);

  return new Promise((resolve) => {
    const existing = synth.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }

    let settled = false;
    const finish = (voices: SpeechSynthesisVoice[]): void => {
      if (settled) return;
      settled = true;
      synth.removeEventListener("voiceschanged", onChange);
      clearTimeout(timer);
      resolve(voices);
    };

    // voiceschanged can fire zero, one, or many times — always re-query.
    const onChange = (): void => {
      const v = synth.getVoices();
      if (v.length > 0) finish(v);
    };

    const timer = setTimeout(() => finish(synth.getVoices()), VOICES_TIMEOUT_MS);
    synth.addEventListener("voiceschanged", onChange);
  });
}

/**
 * Pure tier-selection. Prefer the web tier when it can speak Chinese; otherwise
 * fall back to native when available; otherwise "none".
 */
export function selectTier(args: {
  webSpeechAvailable: boolean;
  zhWebVoice: boolean;
  nativeAvailable: boolean;
}): VoiceTier {
  if (args.webSpeechAvailable && args.zhWebVoice) return "web";
  if (args.nativeAvailable) return "native";
  return "none";
}

// Resolved tier + cached web voice, set once by `initVoice`.
let resolvedTier: VoiceTier | null = null;
let zhWebVoice: SpeechSynthesisVoice | null = null;

/** List native voices via Rust; degrade to empty on any failure (no throw). */
async function listNativeVoices(): Promise<VoiceInfo[]> {
  try {
    return await invoke<VoiceInfo[]>("list_voices");
  } catch {
    return [];
  }
}

/**
 * Probe both tiers once and cache the resolved tier. Idempotent — repeated
 * calls return the already-resolved tier without re-probing. Never throws.
 */
export async function initVoice(): Promise<VoiceTier> {
  if (resolvedTier !== null) return resolvedTier;

  const synth = getSynth();
  const webSpeechAvailable =
    synth !== null && typeof SpeechSynthesisUtterance !== "undefined";

  const webVoices = webSpeechAvailable ? await loadVoices() : [];
  zhWebVoice = webVoices.find((v) => isZhLang(v.lang)) ?? null;

  const nativeVoices = await listNativeVoices();
  const nativeAvailable = nativeVoices.some((v) => isZhLang(v.lang));

  resolvedTier = selectTier({
    webSpeechAvailable,
    zhWebVoice: zhWebVoice !== null,
    nativeAvailable,
  });
  return resolvedTier;
}

/** The resolved tier, or null until `initVoice` has run. */
export function currentTier(): VoiceTier | null {
  return resolvedTier;
}

/** Test-only: reset the cached tier/voice so probing can be re-exercised. */
export function resetVoiceForTests(): void {
  resolvedTier = null;
  zhWebVoice = null;
}

function speakWeb(text: string, rate: number): void {
  const synth = getSynth();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  utterance.rate = clampRate(rate);
  if (zhWebVoice) utterance.voice = zhWebVoice;
  synth.speak(utterance);
}

function speakNative(text: string): void {
  // Fire-and-forget; surface failures without throwing into the render path.
  invoke("speak_tts", { text, lang: SPEECH_LANG }).catch((e: unknown) => {
    console.error("speak_tts failed", e);
  });
}

/**
 * Speak `text` in Chinese via the resolved tier. Returns the tier actually used
 * so callers can react to "none" (show the install hint). Safe before
 * `initVoice` resolves: falls back to the web tier opportunistically.
 *
 * `rate` sets the Web Speech utterance rate (clamped 0.5–2.0); the native tier
 * does not currently take a rate (the `tts` crate's rate API is best-effort and
 * left web-only for now).
 */
export function speak(text: string, rate: number = DEFAULT_RATE): VoiceTier {
  const tier = resolvedTier ?? "web";
  if (tier === "web") speakWeb(text, rate);
  else if (tier === "native") speakNative(text);
  return tier;
}

/** Cancel any queued/active speech across whichever tier is active. */
export function cancelAll(): void {
  const synth = getSynth();
  if (synth) synth.cancel();
  if (resolvedTier === "native") {
    invoke("stop_tts").catch((e: unknown) => {
      console.error("stop_tts failed", e);
    });
  }
}
