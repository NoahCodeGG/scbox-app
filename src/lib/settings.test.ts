import { describe, expect, it } from "vitest";
import type { Settings } from "../hooks/useSettings";
import {
  normalizeClickThroughShortcut,
  normalizeLeadTimeOverride,
  normalizePort,
  normalizeSettings,
  normalizeTheme,
  normalizeVoiceRate,
} from "./settings";

describe("normalizePort", () => {
  it("keeps a valid port", () => {
    expect(normalizePort(5000)).toBe(5000);
    expect(normalizePort(1)).toBe(1);
    expect(normalizePort(65535)).toBe(65535);
  });

  it("falls back to 6119 for out-of-range or non-finite", () => {
    expect(normalizePort(0)).toBe(6119);
    expect(normalizePort(70000)).toBe(6119);
    expect(normalizePort(-1)).toBe(6119);
    expect(normalizePort(Number.NaN)).toBe(6119);
  });

  it("truncates a fractional port", () => {
    expect(normalizePort(6119.9)).toBe(6119);
  });
});

describe("normalizeVoiceRate", () => {
  it("keeps a rate within range", () => {
    expect(normalizeVoiceRate(1.0)).toBe(1.0);
    expect(normalizeVoiceRate(1.5)).toBe(1.5);
  });

  it("clamps to the 0.5–2.0 bounds", () => {
    expect(normalizeVoiceRate(0.1)).toBe(0.5);
    expect(normalizeVoiceRate(5)).toBe(2.0);
  });

  it("falls back to 1.0 for non-finite", () => {
    expect(normalizeVoiceRate(Number.NaN)).toBe(1.0);
  });
});

describe("normalizeLeadTimeOverride", () => {
  it("preserves null (use the build's own lead time)", () => {
    expect(normalizeLeadTimeOverride(null)).toBeNull();
  });

  it("keeps a non-negative number", () => {
    expect(normalizeLeadTimeOverride(0)).toBe(0);
    expect(normalizeLeadTimeOverride(3.5)).toBe(3.5);
  });

  it("treats negative or non-finite as null", () => {
    expect(normalizeLeadTimeOverride(-1)).toBeNull();
    expect(normalizeLeadTimeOverride(Number.NaN)).toBeNull();
  });
});

describe("normalizeSettings", () => {
  const valid: Settings = {
    clientApiPort: 6119,
    leadTimeSecOverride: null,
    voiceEnabled: true,
    recurringVoiceEnabled: true,
    voiceRate: 1.0,
    clickThrough: false,
    windowX: null,
    windowY: null,
    activeBuildOverride: null,
    theme: "system",
    clickThroughShortcut: "CmdOrCtrl+Shift+S",
    prereleaseUpdates: false,
  };

  it("passes a valid settings object through unchanged", () => {
    expect(normalizeSettings(valid)).toEqual(valid);
  });

  it("repairs every out-of-range field at once", () => {
    const repaired = normalizeSettings({
      clientApiPort: 0,
      leadTimeSecOverride: -5,
      voiceEnabled: false,
      recurringVoiceEnabled: false,
      voiceRate: 10,
      clickThrough: true,
      windowX: 100,
      windowY: 200,
      activeBuildOverride: "  ",
      theme: "bogus" as Settings["theme"],
      clickThroughShortcut: "  ",
      prereleaseUpdates: false,
    });
    expect(repaired).toEqual({
      clientApiPort: 6119,
      leadTimeSecOverride: null,
      voiceEnabled: false,
      recurringVoiceEnabled: false,
      voiceRate: 2.0,
      clickThrough: true,
      windowX: 100,
      windowY: 200,
      activeBuildOverride: null,
      theme: "system",
      clickThroughShortcut: "CmdOrCtrl+Shift+S",
      prereleaseUpdates: false,
    });
  });

  it("preserves a non-empty active build override", () => {
    expect(
      normalizeSettings({ ...valid, activeBuildOverride: " tvp.json " })
        .activeBuildOverride,
    ).toBe("tvp.json");
  });
});

describe("normalizeTheme", () => {
  it("keeps each valid theme", () => {
    expect(normalizeTheme("light")).toBe("light");
    expect(normalizeTheme("dark")).toBe("dark");
    expect(normalizeTheme("system")).toBe("system");
  });

  it("coerces invalid or missing values to system", () => {
    expect(normalizeTheme("bogus")).toBe("system");
    expect(normalizeTheme(undefined)).toBe("system");
  });
});

describe("normalizeClickThroughShortcut", () => {
  it("keeps a non-empty trimmed accelerator", () => {
    expect(normalizeClickThroughShortcut("CmdOrCtrl+Alt+P")).toBe(
      "CmdOrCtrl+Alt+P",
    );
    expect(normalizeClickThroughShortcut("  Alt+T  ")).toBe("Alt+T");
  });

  it("falls back to the default for empty or non-string", () => {
    expect(normalizeClickThroughShortcut("")).toBe("CmdOrCtrl+Shift+S");
    expect(normalizeClickThroughShortcut("   ")).toBe("CmdOrCtrl+Shift+S");
    expect(normalizeClickThroughShortcut(undefined)).toBe("CmdOrCtrl+Shift+S");
  });
});
