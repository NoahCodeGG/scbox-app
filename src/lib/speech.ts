// Thin wrapper over the Web Speech API (`window.speechSynthesis`). Degrades to
// a no-op where speech synthesis is unavailable.
//
// NOTE: The assumed runtime is macOS WKWebView (Tauri). Web Speech support
// there can be limited and may need a native-TTS fallback later; for now we
// pick a zh-CN voice when one is offered and otherwise rely on the lang hint.

const SPEECH_LANG = "zh-CN";

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  return voices.find((v) => v.lang === SPEECH_LANG) ?? null;
}

/** Speak `text` in Chinese. No-op when speech synthesis is unavailable. */
export function speak(text: string): void {
  const synth = getSynth();
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  const voice = pickVoice(synth);
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

/** Cancel any queued/active speech. No-op when unavailable. */
export function cancelAll(): void {
  const synth = getSynth();
  if (!synth) return;
  synth.cancel();
}
