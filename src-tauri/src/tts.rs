//! Native text-to-speech fallback for build-order voice cues.
//!
//! The frontend's primary path is the WebView Web Speech API. On Windows
//! (WebView2) that path is unreliable for zh-CN, so these synchronous Tauri
//! commands expose the OS speech engine via the `tts` crate (WinRT on Windows,
//! AVFoundation on macOS, Speech Dispatcher on Linux).
//!
//! IMPORTANT (hard constraint): `tts::Tts` holds an `Rc` and is therefore
//! `!Send`/`!Sync`. It MUST NOT be stored in `app.manage()`/`State` nor held
//! across an `.await`. To play cues sequentially without clobbering each other,
//! one long-lived `Tts` lives on a dedicated worker thread; the rest of the app
//! only ever holds the `mpsc::Sender` (which is `Send + Sync`). `list_voices`
//! still uses a one-shot temp `Tts` for enumeration on the calling thread.

use serde::Serialize;
use std::sync::mpsc::{self, Sender};
use std::thread;
use tts::Tts;

/// A unit of work for the persistent TTS worker thread. `Send` (plain owned
/// `String`s) so it can cross the channel; the `Tts` itself never does.
pub enum TtsCommand {
    /// Speak `text` using a voice matching `lang` (best-effort), queued behind
    /// any in-flight utterance (`interrupt = false`).
    Speak { text: String, lang: String },
    /// Stop/flush any in-flight and queued speech.
    Stop,
}

/// Tauri-managed handle to the TTS worker. Holds only the `Sender`, so it is
/// `Send + Sync` and safe to `app.manage()` (unlike `Tts`).
pub struct TtsHandle(pub Sender<TtsCommand>);

/// Spawn the persistent TTS worker thread and return a `Sender` for it.
///
/// The thread constructs exactly one `Tts` and keeps it alive for the thread's
/// lifetime, so the `!Send`/`!Sync` engine never leaves this thread. It then
/// loops on `recv()`, speaking with `interrupt = false` so bunched cues queue
/// in order instead of cancelling one another. The loop exits cleanly when the
/// channel closes (all senders dropped, i.e. app shutdown).
pub fn spawn_tts_worker() -> Sender<TtsCommand> {
    let (tx, rx) = mpsc::channel::<TtsCommand>();

    thread::spawn(move || {
        let mut tts = match Tts::default() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("tts worker: failed to construct Tts: {e}");
                return;
            }
        };

        // recv() returns Err only when every Sender has been dropped, which is
        // our clean shutdown signal.
        while let Ok(cmd) = rx.recv() {
            match cmd {
                TtsCommand::Speak { text, lang } => {
                    set_voice_for_lang(&mut tts, &lang);
                    if let Err(e) = tts.speak(text, false) {
                        eprintln!("tts worker: speak failed: {e}");
                    }
                }
                TtsCommand::Stop => {
                    if let Err(e) = tts.stop() {
                        eprintln!("tts worker: stop failed: {e}");
                    }
                }
            }
        }
    });

    tx
}

/// Best-effort: select the installed voice whose language matches `lang` on its
/// primary subtag. Any failure is logged and ignored so the worker keeps going.
fn set_voice_for_lang(tts: &mut Tts, lang: &str) {
    if !tts.supported_features().voice {
        return;
    }
    if let Ok(voices) = tts.voices() {
        if let Some(voice) = voices
            .into_iter()
            .find(|v| lang_matches(v.language().as_ref(), lang))
        {
            if let Err(e) = tts.set_voice(&voice) {
                eprintln!("tts worker: set_voice failed: {e}");
            }
        }
    }
}

/// One installed system voice, surfaced to the frontend so it can decide
/// whether a zh-CN voice exists natively.
///
/// Cross-layer contract: mirrored by `VoiceInfo` in `src/lib/speech.ts`. Field
/// names are single-word, so the serialized JSON keys match the TS type as-is.
#[derive(Debug, Clone, Serialize)]
pub struct VoiceInfo {
    /// Backend-specific stable identifier for the voice.
    pub id: String,
    /// Human-readable display name.
    pub name: String,
    /// BCP-47 language tag string (e.g. "zh-CN").
    pub lang: String,
}

/// Whether a voice's language tag matches a wanted tag on its primary subtag.
///
/// We compare only the primary language subtag (the part before the first `-`
/// or `_`), case-insensitively, so `want = "zh-CN"` matches `"zh-CN"`,
/// `"zh_CN"`, and `"zh-Hans-CN"` but not `"en-US"`.
pub fn lang_matches(voice_lang: &str, want: &str) -> bool {
    primary_subtag(voice_lang).eq_ignore_ascii_case(primary_subtag(want))
}

/// The primary language subtag: everything before the first `-` or `_`.
fn primary_subtag(tag: &str) -> &str {
    tag.split(['-', '_']).next().unwrap_or(tag)
}

/// Enumerate the installed system voices.
///
/// Returns an empty list (Ok) when the backend does not support voice
/// enumeration, so the frontend can treat "no native zh-CN voice" uniformly.
#[tauri::command]
pub fn list_voices() -> Result<Vec<VoiceInfo>, String> {
    let tts = Tts::default().map_err(|e| e.to_string())?;
    if !tts.supported_features().voice {
        return Ok(Vec::new());
    }
    let voices = tts.voices().map_err(|e| e.to_string())?;
    let infos = voices
        .into_iter()
        .map(|v| VoiceInfo {
            id: v.id(),
            name: v.name(),
            lang: v.language().to_string(),
        })
        .collect();
    Ok(infos)
}

/// Queue `text` for the persistent worker, speaking it with a voice matching
/// `lang` behind any in-flight utterance. Returns once the command is handed to
/// the channel; actual audio plays on the worker thread.
///
/// Cross-layer contract: the frontend calls `invoke("speak_tts", { text, lang })`.
/// `handle` is injected by Tauri's managed state, not passed from JS.
#[tauri::command]
pub fn speak_tts(
    handle: tauri::State<'_, TtsHandle>,
    text: String,
    lang: String,
) -> Result<(), String> {
    handle
        .0
        .send(TtsCommand::Speak { text, lang })
        .map_err(|e| e.to_string())
}

/// Stop any in-flight/queued speech. Best-effort. Cross-layer contract: the
/// frontend calls `invoke("stop_tts")` with no args; `handle` is injected.
#[tauri::command]
pub fn stop_tts(handle: tauri::State<'_, TtsHandle>) -> Result<(), String> {
    handle.0.send(TtsCommand::Stop).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_same_primary_subtag_with_hyphen() {
        assert!(lang_matches("zh-CN", "zh-CN"));
    }

    #[test]
    fn matches_underscore_separator() {
        assert!(lang_matches("zh_CN", "zh-CN"));
    }

    #[test]
    fn matches_extended_script_subtag() {
        assert!(lang_matches("zh-Hans-CN", "zh-CN"));
    }

    #[test]
    fn matches_bare_primary_subtag() {
        assert!(lang_matches("zh", "zh-CN"));
    }

    #[test]
    fn is_case_insensitive() {
        assert!(lang_matches("ZH-cn", "zh-CN"));
    }

    #[test]
    fn does_not_match_different_language() {
        assert!(!lang_matches("en-US", "zh-CN"));
    }

    #[test]
    fn empty_voice_lang_does_not_match() {
        assert!(!lang_matches("", "zh-CN"));
    }
}
