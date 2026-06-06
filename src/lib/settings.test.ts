import { describe, expect, it } from "vitest";
import type { Settings } from "../hooks/useSettings";
import {
  normalizeLeadTimeOverride,
  normalizePort,
  normalizeSettings,
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
    playerName: "Maru",
    clientApiPort: 6119,
    leadTimeSecOverride: null,
    voiceEnabled: true,
    voiceRate: 1.0,
    clickThrough: false,
    windowX: null,
    windowY: null,
  };

  it("passes a valid settings object through unchanged", () => {
    expect(normalizeSettings(valid)).toEqual(valid);
  });

  it("repairs every out-of-range field at once", () => {
    const repaired = normalizeSettings({
      playerName: "Sn",
      clientApiPort: 0,
      leadTimeSecOverride: -5,
      voiceEnabled: false,
      voiceRate: 10,
      clickThrough: true,
      windowX: 100,
      windowY: 200,
    });
    expect(repaired).toEqual({
      playerName: "Sn",
      clientApiPort: 6119,
      leadTimeSecOverride: null,
      voiceEnabled: false,
      voiceRate: 2.0,
      clickThrough: true,
      windowX: 100,
      windowY: 200,
    });
  });
});
