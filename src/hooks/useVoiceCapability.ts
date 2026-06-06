import { useEffect, useState } from "react";
import { initVoice, type VoiceTier } from "../lib/speech";

/** Voice-output capability surfaced to the UI. */
export interface VoiceCapability {
  /** Resolved output tier, or null until probing completes. */
  tier: VoiceTier | null;
  /** True when no zh-CN voice exists on any tier — show the install hint. */
  needsInstallHint: boolean;
}

/**
 * Probes the available voice tiers once on mount (web zh-CN voice + native
 * engine) and reports the resolved tier. `initVoice` is idempotent and never
 * throws, so this is StrictMode-safe and degrades to a "none" hint on failure.
 */
export function useVoiceCapability(): VoiceCapability {
  const [tier, setTier] = useState<VoiceTier | null>(null);

  useEffect(() => {
    let cancelled = false;
    initVoice().then((resolved) => {
      if (!cancelled) setTier(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { tier, needsInstallHint: tier === "none" };
}
