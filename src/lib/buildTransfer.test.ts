import { describe, expect, it } from "vitest";
import { exportBuildJson, parseImportedBuild } from "./buildTransfer";
import type { BuildOrder } from "../types/build";

function build(overrides: Partial<BuildOrder> = {}): BuildOrder {
  return {
    matchup: "TvP",
    race: "Terran",
    name: "test build",
    leadTimeSec: 4,
    steps: [
      { time: 17, say: "14 补给站" },
      { time: 30, say: "兵营" },
    ],
    ...overrides,
  };
}

describe("exportBuildJson", () => {
  it("serializes only contract fields as 2-space pretty JSON", () => {
    const json = exportBuildJson(build());
    expect(json).toBe(JSON.stringify(build(), null, 2));
  });

  it("never leaks filename and emits only time/say steps", () => {
    const json = exportBuildJson(build());
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect("filename" in parsed).toBe(false);
    const steps = parsed.steps as Array<Record<string, unknown>>;
    expect(Object.keys(steps[0]).sort()).toEqual(["say", "time"]);
  });

  it("drops any extra keys present on the source object", () => {
    const dirty = { ...build(), filename: "tvp.json", extra: 1 } as BuildOrder;
    const parsed = JSON.parse(exportBuildJson(dirty)) as Record<string, unknown>;
    expect(Object.keys(parsed).sort()).toEqual([
      "leadTimeSec",
      "matchup",
      "name",
      "race",
      "steps",
    ]);
  });
});

describe("parseImportedBuild", () => {
  it("round-trips an exported build", () => {
    const json = exportBuildJson(build());
    const result = parseImportedBuild(json);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build).toEqual(build());
    }
  });

  it("rejects malformed JSON", () => {
    const result = parseImportedBuild("{ not json");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSON 解析失败");
  });

  it("rejects a JSON array", () => {
    const result = parseImportedBuild("[]");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("格式不是有效的建造顺序对象");
  });

  it("rejects a JSON primitive", () => {
    const result = parseImportedBuild("42");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("格式不是有效的建造顺序对象");
  });

  it("rejects null", () => {
    const result = parseImportedBuild("null");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-array steps field", () => {
    const result = parseImportedBuild(
      JSON.stringify({ matchup: "TvP", race: "Terran", leadTimeSec: 4, steps: {} }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("steps 必须是数组");
  });

  it("rejects missing matchup", () => {
    const result = parseImportedBuild(
      JSON.stringify({ race: "Terran", leadTimeSec: 4, steps: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("对阵");
  });

  it("rejects missing race", () => {
    const result = parseImportedBuild(
      JSON.stringify({ matchup: "TvP", leadTimeSec: 4, steps: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("种族");
  });

  it("rejects missing name", () => {
    const result = parseImportedBuild(
      JSON.stringify({ matchup: "TvP", race: "Terran", leadTimeSec: 4, steps: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("名称");
  });

  it("rejects a non-numeric step time", () => {
    const result = parseImportedBuild(
      JSON.stringify({
        matchup: "TvP",
        race: "Terran",
        name: "x",
        leadTimeSec: 4,
        steps: [{ time: "soon", say: "兵营" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("mm:ss");
  });

  it("rejects a negative step time", () => {
    const result = parseImportedBuild(
      JSON.stringify({
        matchup: "TvP",
        race: "Terran",
        name: "x",
        leadTimeSec: 4,
        steps: [{ time: -5, say: "兵营" }],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("mm:ss");
  });

  it("ignores a legacy supply field on imported steps", () => {
    const result = parseImportedBuild(
      JSON.stringify({
        matchup: "TvP",
        race: "Terran",
        name: "x",
        leadTimeSec: 4,
        steps: [{ time: 17, say: "补给站", supply: 14 }],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.steps[0]).toEqual({ time: 17, say: "补给站" });
    }
  });

  it("treats missing steps as an empty build", () => {
    const result = parseImportedBuild(
      JSON.stringify({ matchup: "TvP", race: "Terran", name: "x", leadTimeSec: 4 }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.build.steps).toEqual([]);
  });

  it("sorts imported steps ascending by time", () => {
    const result = parseImportedBuild(
      JSON.stringify({
        matchup: "TvP",
        race: "Terran",
        name: "x",
        leadTimeSec: 4,
        steps: [
          { time: 30, say: "兵营" },
          { time: 17, say: "补给站" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.steps.map((s) => s.time)).toEqual([17, 30]);
    }
  });
});
