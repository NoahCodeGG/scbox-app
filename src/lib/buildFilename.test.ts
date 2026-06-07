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

  it("keeps CJK / unicode letters in the slug", () => {
    expect(generateBuildFilename("两船兵", [])).toBe("两船兵.json");
    expect(generateBuildFilename("TvZ 两船兵", [])).toBe("tvz-两船兵.json");
  });

  it("dedupes distinct unicode names instead of collapsing to 'build'", () => {
    expect(generateBuildFilename("两船兵", [])).toBe("两船兵.json");
    expect(generateBuildFilename("飞龙", ["两船兵.json"])).toBe("飞龙.json");
    expect(generateBuildFilename("两船兵", ["两船兵.json"])).toBe("两船兵-2.json");
  });

  it("suffixes to avoid collisions (case-insensitive)", () => {
    expect(generateBuildFilename("TvP", ["tvp.json"])).toBe("tvp-2.json");
    expect(
      generateBuildFilename("TvP", ["TVP.json", "tvp-2.json"]),
    ).toBe("tvp-3.json");
  });
});
