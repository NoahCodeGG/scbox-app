import { describe, expect, it } from "vitest";
import type { BuildOrder } from "../types/build";
import { FALLBACK_BUILD, pickActiveBuild } from "./builds";

const buildA: BuildOrder = {
  matchup: "TvP",
  race: "Terran",
  leadTimeSec: 4,
  steps: [{ time: 17, say: "supply" }],
};

const buildB: BuildOrder = { ...buildA, matchup: "TvZ" };

describe("pickActiveBuild", () => {
  it("returns the first build when several are loaded", () => {
    expect(pickActiveBuild([buildA, buildB])).toBe(buildA);
  });

  it("returns null when none are loaded", () => {
    expect(pickActiveBuild([])).toBeNull();
  });
});

describe("FALLBACK_BUILD", () => {
  it("is a usable build with at least one step", () => {
    expect(FALLBACK_BUILD.race).toBe("Terran");
    expect(FALLBACK_BUILD.steps.length).toBeGreaterThan(0);
  });

  it("drops doc-only keys like _note", () => {
    expect("_note" in FALLBACK_BUILD).toBe(false);
  });
});
