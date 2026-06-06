import { describe, expect, it } from "vitest";
import { generateBuildFilename } from "./buildFilename";

describe("generateBuildFilename", () => {
  it("slugifies the matchup into a json filename", () => {
    expect(generateBuildFilename("TvP", [])).toBe("tvp.json");
    expect(generateBuildFilename("TvZ all-in", [])).toBe("tvz-all-in.json");
  });

  it("falls back to 'build' for an empty/symbol-only matchup", () => {
    expect(generateBuildFilename("   ", [])).toBe("build.json");
    expect(generateBuildFilename("!!!", [])).toBe("build.json");
  });

  it("suffixes to avoid collisions (case-insensitive)", () => {
    expect(generateBuildFilename("TvP", ["tvp.json"])).toBe("tvp-2.json");
    expect(
      generateBuildFilename("TvP", ["TVP.json", "tvp-2.json"]),
    ).toBe("tvp-3.json");
  });
});
