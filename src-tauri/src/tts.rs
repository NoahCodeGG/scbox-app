//! Native text-to-speech fallback for build-order voice cues.
//!
//! The frontend's primary path is the WebView Web Speech API. On Windows
//! (WebView2) that path is unreliable for zh-CN, so these synchronous Tauri
//! commands expose the OS speech engine via the `tts` crate (WinRT on Windows,
//! AVFoundation on macOS, Speech Dispatcher on Linux).
//!
//! IMPORTANT (hard constraint): `tts::Tts` holds an `Rc` and is therefore
//! `!Send`/`!Sync`. It MUST NOT be stored in `app.manage()`/`State` nor held
//! across an `.await`. Every command below constructs a fresh `Tts` on the
//! calling (synchronous) thread and drops it before returning.

use serde::Serialize;
use tts::Tts;

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

/// Speak `text` using a voice whose language matches `lang` (on the primary
/// subtag) when one is installed, interrupting any in-flight utterance.
///
/// Synchronous by design (see module note): constructs and drops `Tts` here.
#[tauri::command]
pub fn speak_tts(text: String, lang: String) -> Result<(), String> {
    let mut tts = Tts::default().map_err(|e| e.to_string())?;

    if tts.supported_features().voice {
        if let Ok(voices) = tts.voices() {
            if let Some(voice) = voices
                .into_iter()
                .find(|v| lang_matches(&v.language().to_string(), &lang))
            {
                let _ = tts.set_voice(&voice);
            }
        }
    }

    tts.speak(text, true).map(|_| ()).map_err(|e| e.to_string())
}

/// Stop any in-flight/queued speech. Best-effort.
#[tauri::command]
pub fn stop_tts() -> Result<(), String> {
    let mut tts = Tts::default().map_err(|e| e.to_string())?;
    tts.stop().map(|_| ()).map_err(|e| e.to_string())
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
