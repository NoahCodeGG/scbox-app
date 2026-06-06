import { describe, expect, it } from "vitest";
import { FALLBACK_BUILD } from "./builds";

describe("FALLBACK_BUILD", () => {
  it("is a usable build with at least one step", () => {
    expect(FALLBACK_BUILD.race).toBe("Terran");
    expect(FALLBACK_BUILD.steps.length).toBeGreaterThan(0);
  });

  it("drops doc-only keys like _note", () => {
    expect("_note" in FALLBACK_BUILD).toBe(false);
  });
});
