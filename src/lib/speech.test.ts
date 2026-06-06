import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the Tauri invoke boundary before importing the module under test.
const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (cmd: string, args?: unknown) => invokeMock(cmd, args),
}));

import {
  cancelAll,
  createSpeechQueue,
  estimateDurationMs,
  FRESHNESS_MS,
  hasZhVoice,
  initVoice,
  loadVoices,
  resetVoiceForTests,
  selectTier,
  speak,
} from "./speech";
import type { Cue } from "./speech";

type Listener = () => void;

/** Minimal SpeechSynthesisVoice stand-in (only `lang` is read). */
function voice(lang: string): SpeechSynthesisVoice {
  return { lang } as SpeechSynthesisVoice;
}

/**
 * Install a fake `window.speechSynthesis`. `voicesSequence` lets the first
 * `getVoices()` return one list and later calls return another (to simulate
 * the async `voiceschanged` population).
 */
function stubSynth(options: {
  voicesSequence: SpeechSynthesisVoice[][];
  captureCancel?: () => void;
}) {
  const listeners: Listener[] = [];
  let call = 0;
  const synth = {
    getVoices: () => {
      const idx = Math.min(call, options.voicesSequence.length - 1);
      call += 1;
      return options.voicesSequence[idx];
    },
    addEventListener: (_type: string, cb: Listener) => listeners.push(cb),
    removeEventListener: (_type: string, cb: Listener) => {
      const i = listeners.indexOf(cb);
      if (i >= 0) listeners.splice(i, 1);
    },
    cancel: () => options.captureCancel?.(),
    speak: vi.fn(),
  };
  vi.stubGlobal("window", { speechSynthesis: synth });
  // Some code paths reference the constructor's existence.
  vi.stubGlobal("SpeechSynthesisUtterance", class {});
  return { synth, fireVoicesChanged: () => listeners.forEach((l) => l()) };
}

afterEach(() => {
  vi.unstubAllGlobals();
  invokeMock.mockReset();
  resetVoiceForTests();
});

describe("selectTier", () => {
  it("chooses web when web speech has a zh voice", () => {
    expect(
      selectTier({
        webSpeechAvailable: true,
        zhWebVoice: true,
        nativeAvailable: true,
      }),
    ).toBe("web");
  });

  it("chooses native when web lacks a zh voice but native exists", () => {
    expect(
      selectTier({
        webSpeechAvailable: true,
        zhWebVoice: false,
        nativeAvailable: true,
      }),
    ).toBe("native");
  });

  it("chooses native when web speech is unavailable but native exists", () => {
    expect(
      selectTier({
        webSpeechAvailable: false,
        zhWebVoice: false,
        nativeAvailable: true,
      }),
    ).toBe("native");
  });

  it("chooses none when no zh voice exists on any tier", () => {
    expect(
      selectTier({
        webSpeechAvailable: true,
        zhWebVoice: false,
        nativeAvailable: false,
      }),
    ).toBe("none");
  });
});

describe("hasZhVoice", () => {
  it("detects a zh-CN voice", () => {
    expect(hasZhVoice([voice("en-US"), voice("zh-CN")])).toBe(true);
  });

  it("detects zh on the primary subtag regardless of region/case", () => {
    expect(hasZhVoice([voice("ZH-Hans-CN")])).toBe(true);
  });

  it("returns false without any zh voice", () => {
    expect(hasZhVoice([voice("en-US"), voice("ja-JP")])).toBe(false);
  });

  it("returns false for an empty list", () => {
    expect(hasZhVoice([])).toBe(false);
  });
});

describe("loadVoices", () => {
  it("resolves immediately when voices are already populated", async () => {
    stubSynth({ voicesSequence: [[voice("zh-CN")]] });
    const voices = await loadVoices();
    expect(voices.map((v) => v.lang)).toEqual(["zh-CN"]);
  });

  it("waits for voiceschanged when the first call is empty", async () => {
    const { fireVoicesChanged } = stubSynth({
      voicesSequence: [[], [voice("zh-CN")]],
    });
    const pending = loadVoices();
    fireVoicesChanged();
    const voices = await pending;
    expect(voices.map((v) => v.lang)).toEqual(["zh-CN"]);
  });

  it("resolves with the (possibly empty) list on timeout", async () => {
    vi.useFakeTimers();
    stubSynth({ voicesSequence: [[]] });
    const pending = loadVoices();
    await vi.advanceTimersByTimeAsync(1500);
    const voices = await pending;
    expect(voices).toEqual([]);
    vi.useRealTimers();
  });

  it("resolves empty when speechSynthesis is unavailable", async () => {
    vi.stubGlobal("window", {});
    expect(await loadVoices()).toEqual([]);
  });
});

describe("initVoice tier resolution", () => {
  it("resolves web when a zh-CN web voice is present", async () => {
    stubSynth({ voicesSequence: [[voice("zh-CN")]] });
    invokeMock.mockResolvedValue([]);
    expect(await initVoice()).toBe("web");
  });

  it("resolves native when only the native engine has a zh voice", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockResolvedValue([{ id: "1", name: "Huihui", lang: "zh-CN" }]);
    expect(await initVoice()).toBe("native");
  });

  it("resolves none when neither tier has a zh voice", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockResolvedValue([{ id: "1", name: "David", lang: "en-US" }]);
    expect(await initVoice()).toBe("none");
  });

  it("treats a failing list_voices invoke as no native voice", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockRejectedValue(new Error("ipc down"));
    expect(await initVoice()).toBe("none");
  });
});

describe("speak / cancelAll routing", () => {
  it("native tier invokes speak_tts with zh-CN", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockResolvedValue([{ id: "1", name: "Huihui", lang: "zh-CN" }]);
    await initVoice();
    invokeMock.mockClear();
    invokeMock.mockResolvedValue(undefined);

    const tier = speak("补农民");
    // The cue is enqueued and the pump runs on a microtask; let it drain.
    await Promise.resolve();
    await Promise.resolve();

    expect(tier).toBe("native");
    expect(invokeMock).toHaveBeenCalledWith("speak_tts", {
      text: "补农民",
      lang: "zh-CN",
    });
  });

  it("none tier produces no audio and reports none", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockResolvedValue([]);
    await initVoice();
    invokeMock.mockClear();

    expect(speak("补农民")).toBe("none");
    await Promise.resolve();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("cancelAll calls stop_tts only on the native tier", async () => {
    stubSynth({ voicesSequence: [[voice("en-US")]] });
    invokeMock.mockResolvedValue([{ id: "1", name: "Huihui", lang: "zh-CN" }]);
    await initVoice();
    invokeMock.mockClear();
    invokeMock.mockResolvedValue(undefined);

    cancelAll();

    expect(invokeMock).toHaveBeenCalledWith("stop_tts", undefined);
  });

  it("cancelAll does not call stop_tts on the web tier", async () => {
    let cancelled = false;
    stubSynth({
      voicesSequence: [[voice("zh-CN")]],
      captureCancel: () => {
        cancelled = true;
      },
    });
    invokeMock.mockResolvedValue([]);
    await initVoice();
    invokeMock.mockClear();

    cancelAll();

    expect(cancelled).toBe(true);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});

describe("createSpeechQueue", () => {
  /** A speakOne that records cues and resolves when the test releases each one. */
  function deferredSpeaker() {
    const spoken: Cue[] = [];
    const releases: Array<() => void> = [];
    const speakOne = (cue: Cue): Promise<void> => {
      spoken.push(cue);
      return new Promise<void>((resolve) => releases.push(resolve));
    };
    return {
      spoken,
      speakOne,
      releaseNext: () => {
        const r = releases.shift();
        if (r) r();
      },
    };
  }

  it("plays cues sequentially in FIFO order, one at a time", async () => {
    const { spoken, speakOne, releaseNext } = deferredSpeaker();
    const queue = createSpeechQueue({ now: () => 0, speakOne });

    queue.enqueue({ text: "a", rate: 1, enqueuedAt: 0 });
    queue.enqueue({ text: "b", rate: 1, enqueuedAt: 0 });
    queue.enqueue({ text: "c", rate: 1, enqueuedAt: 0 });

    await Promise.resolve();
    // Only the first cue is in flight until it resolves.
    expect(spoken.map((c) => c.text)).toEqual(["a"]);

    releaseNext();
    await Promise.resolve();
    await Promise.resolve();
    expect(spoken.map((c) => c.text)).toEqual(["a", "b"]);

    releaseNext();
    await Promise.resolve();
    await Promise.resolve();
    expect(spoken.map((c) => c.text)).toEqual(["a", "b", "c"]);
  });

  it("drops a cue older than the freshness window before it starts", async () => {
    const { spoken, speakOne, releaseNext } = deferredSpeaker();
    // The clock already reads past the freshness window relative to the stale
    // cue's enqueue time, so it is dropped the moment the pump reaches it.
    const nowValue = FRESHNESS_MS + 1;
    const queue = createSpeechQueue({ now: () => nowValue, speakOne });

    queue.enqueue({ text: "stale", rate: 1, enqueuedAt: 0 });
    queue.enqueue({ text: "fresh", rate: 1, enqueuedAt: FRESHNESS_MS + 1 });

    await Promise.resolve();
    // "stale" is skipped; the pump moves on to "fresh".
    expect(spoken.map((c) => c.text)).toEqual(["fresh"]);

    releaseNext();
    await Promise.resolve();
    expect(spoken.map((c) => c.text)).toEqual(["fresh"]);
  });

  it("clear() empties pending cues so they never play", async () => {
    const { spoken, speakOne, releaseNext } = deferredSpeaker();
    const queue = createSpeechQueue({ now: () => 0, speakOne });

    queue.enqueue({ text: "a", rate: 1, enqueuedAt: 0 });
    queue.enqueue({ text: "b", rate: 1, enqueuedAt: 0 });

    await Promise.resolve();
    expect(spoken.map((c) => c.text)).toEqual(["a"]); // "a" in flight

    queue.clear(); // drop pending "b"
    releaseNext(); // resolve the in-flight "a"
    await Promise.resolve();
    await Promise.resolve();

    expect(spoken.map((c) => c.text)).toEqual(["a"]); // "b" never played
  });
});

describe("estimateDurationMs", () => {
  it("uses the base cost for empty text (above the floor)", () => {
    // base 600 alone is already above the 400 floor; the floor is the lower
    // clamp boundary, never exceeded by a positive-length contribution.
    expect(estimateDurationMs("")).toBe(600);
  });

  it("clamps a very long text down to the maximum", () => {
    expect(estimateDurationMs("x".repeat(1000))).toBe(6000);
  });

  it("scales between the bounds for mid-length text", () => {
    // base 600 + 10 chars * 90 = 1500, within [400, 6000].
    expect(estimateDurationMs("x".repeat(10))).toBe(1500);
  });
});
