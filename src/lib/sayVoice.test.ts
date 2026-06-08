import { describe, expect, it } from "vitest";
import type { BuildStep } from "../types/build";
import { humanize, spokenText } from "./sayVoice";

describe("humanize", () => {
  it("expands xN shorthand to N个", () => {
    expect(humanize("火车 x2")).toBe("火车 2个");
    expect(humanize("探机 x2")).toBe("探机 2个");
    expect(humanize("小狗 x10")).toBe("小狗 10个");
  });

  it("turns the . action separator into a spoken pause (space)", () => {
    expect(humanize("注卵.菌毯")).toBe("注卵 菌毯");
    expect(humanize("注卵.菌毯.工蜂")).toBe("注卵 菌毯 工蜂");
  });

  it("handles xN and . together", () => {
    expect(humanize("工蜂 x2.女王")).toBe("工蜂 2个 女王");
    expect(humanize("虫后 x2.小狗 x4")).toBe("虫后 2个 小狗 4个");
  });

  it("leaves plain text untouched", () => {
    expect(humanize("SCV")).toBe("SCV");
    expect(humanize("探机")).toBe("探机");
    expect(humanize("星轨 双倍挂件")).toBe("星轨 双倍挂件");
  });

  it("collapses whitespace and trims", () => {
    expect(humanize("注卵 . 菌毯")).toBe("注卵 菌毯");
  });
});

describe("spokenText", () => {
  const step = (over: Partial<BuildStep>): BuildStep => ({
    time: 100,
    say: "火车 x2",
    ...over,
  });

  it("reads sayAs override verbatim when set", () => {
    expect(spokenText(step({ sayAs: "造两辆火车" }))).toBe("造两辆火车");
  });

  it("falls back to humanize(say) when sayAs is absent", () => {
    expect(spokenText(step({}))).toBe("火车 2个");
  });

  it("treats empty/whitespace sayAs as unset and falls back", () => {
    expect(spokenText(step({ sayAs: "" }))).toBe("火车 2个");
    expect(spokenText(step({ sayAs: "   " }))).toBe("火车 2个");
  });
});
