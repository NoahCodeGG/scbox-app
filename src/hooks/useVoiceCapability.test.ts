// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VoiceTier } from "../lib/speech";
import { useVoiceCapability } from "./useVoiceCapability";

const initVoiceMock = vi.fn<() => Promise<VoiceTier>>();

vi.mock("../lib/speech", () => ({
  initVoice: () => initVoiceMock(),
}));

describe("useVoiceCapability", () => {
  beforeEach(() => {
    initVoiceMock.mockReset();
  });

  it("starts with a null tier before probing resolves", () => {
    let resolve: (tier: VoiceTier) => void = () => {};
    initVoiceMock.mockReturnValue(
      new Promise<VoiceTier>((r) => {
        resolve = r;
      }),
    );

    const { result } = renderHook(() => useVoiceCapability());

    expect(result.current.tier).toBeNull();
    expect(result.current.needsInstallHint).toBe(false);
    resolve("web");
  });

  it("sets the resolved tier and no install hint for a usable tier", async () => {
    initVoiceMock.mockResolvedValue("web");

    const { result } = renderHook(() => useVoiceCapability());

    await waitFor(() => expect(result.current.tier).toBe("web"));
    expect(result.current.needsInstallHint).toBe(false);
  });

  it("flags needsInstallHint only when the tier is none", async () => {
    initVoiceMock.mockResolvedValue("none");

    const { result } = renderHook(() => useVoiceCapability());

    await waitFor(() => expect(result.current.tier).toBe("none"));
    expect(result.current.needsInstallHint).toBe(true);
  });

  it("does not set state after unmount (cancelled flag)", async () => {
    let resolve: (tier: VoiceTier) => void = () => {};
    initVoiceMock.mockReturnValue(
      new Promise<VoiceTier>((r) => {
        resolve = r;
      }),
    );

    const { result, unmount } = renderHook(() => useVoiceCapability());
    unmount();

    // Resolving after unmount must not throw or warn about a dead update.
    resolve("native");
    await Promise.resolve();

    expect(result.current.tier).toBeNull();
  });
});
