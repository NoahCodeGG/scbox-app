import { describe, expect, it } from "vitest";
import {
  validateBuild,
  type DraftBuild,
  type DraftRecurring,
} from "./buildValidation";

function draft(overrides: Partial<DraftBuild> = {}): DraftBuild {
  return {
    matchup: "TvP",
    race: "Terran",
    name: "test build",
    leadTimeSec: "4",
    steps: [{ time: "17", say: "14 补给站", sayAs: "" }],
    recurring: [],
    ...overrides,
  };
}

function recurring(
  overrides: Partial<DraftRecurring> = {},
): DraftRecurring {
  return {
    startSec: "162",
    intervalSec: "29",
    endSec: "",
    say: "注卵",
    sayAs: "",
    ...overrides,
  };
}

describe("validateBuild", () => {
  it("accepts a valid draft and trims fields", () => {
    const result = validateBuild(
      draft({ matchup: " TvP ", race: " Terran " }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.matchup).toBe("TvP");
      expect(result.build.race).toBe("Terran");
      expect(result.build.leadTimeSec).toBe(4);
      expect(result.build.steps[0]).toEqual({
        time: 17,
        say: "14 补给站",
      });
    }
  });

  it("sorts steps ascending by time regardless of entry order", () => {
    const result = validateBuild(
      draft({
        steps: [
          { time: "40", say: "精炼厂", sayAs: "" },
          { time: "17", say: "补给站", sayAs: "" },
          { time: "30", say: "兵营", sayAs: "" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.steps.map((s) => s.time)).toEqual([17, 30, 40]);
    }
  });

  it("rejects empty matchup / race", () => {
    expect(validateBuild(draft({ matchup: "  " })).ok).toBe(false);
    expect(validateBuild(draft({ race: "" })).ok).toBe(false);
  });

  it("rejects an empty name", () => {
    expect(validateBuild(draft({ name: "   " })).ok).toBe(false);
  });

  it("rejects an empty step say", () => {
    const result = validateBuild(
      draft({ steps: [{ time: "10", say: "  ", sayAs: "" }] }),
    );
    expect(result.ok).toBe(false);
  });

  it("rejects negative or non-numeric time", () => {
    expect(
      validateBuild(draft({ steps: [{ time: "-5", say: "x", sayAs: "" }] })).ok,
    ).toBe(false);
    expect(
      validateBuild(draft({ steps: [{ time: "abc", say: "x", sayAs: "" }] })).ok,
    ).toBe(false);
  });

  it("rejects non-numeric lead time", () => {
    expect(validateBuild(draft({ leadTimeSec: "soon" })).ok).toBe(false);
  });

  it("accepts an mm:ss step time and stores it as seconds", () => {
    const result = validateBuild(
      draft({ steps: [{ time: "3:55", say: "x", sayAs: "" }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.build.steps[0].time).toBe(235);
  });

  it("accepts a build with no steps", () => {
    const result = validateBuild(draft({ steps: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.build.steps).toEqual([]);
  });

  it("omits sayAs from the step when it is empty/whitespace", () => {
    const result = validateBuild(
      draft({ steps: [{ time: "17", say: "补给站", sayAs: "  " }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.steps[0]).toEqual({ time: 17, say: "补给站" });
      expect("sayAs" in result.build.steps[0]).toBe(false);
    }
  });

  it("keeps a trimmed sayAs on the step when non-empty", () => {
    const result = validateBuild(
      draft({ steps: [{ time: "166", say: "火车 x2", sayAs: " 造两辆火车 " }] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.steps[0]).toEqual({
        time: 166,
        say: "火车 x2",
        sayAs: "造两辆火车",
      });
    }
  });
});

describe("validateBuild recurring", () => {
  it("omits recurring entirely when there are no cues", () => {
    const result = validateBuild(draft({ recurring: [] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect("recurring" in result.build).toBe(false);
  });

  it("accepts multiple valid cues in input order", () => {
    const result = validateBuild(
      draft({
        recurring: [
          recurring({ say: "注卵", startSec: "162", intervalSec: "29" }),
          recurring({ say: "菌毯", startSec: "120", intervalSec: "40" }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.recurring).toEqual([
        { startSec: 162, intervalSec: 29, say: "注卵" },
        { startSec: 120, intervalSec: 40, say: "菌毯" },
      ]);
    }
  });

  it("rejects an empty cue say", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ say: "  " })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("第 1 条循环提醒的语音内容");
  });

  it("rejects an invalid startSec", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ startSec: "soon" })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("起始时间格式");
  });

  it("rejects a zero interval", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ intervalSec: "0" })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("间隔必须大于 0");
  });

  it("rejects a negative interval", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ intervalSec: "-5" })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("间隔必须大于 0");
  });

  it("rejects endSec earlier than startSec", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ startSec: "200", endSec: "100" })] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("结束时间不能早于起始时间");
  });

  it("omits endSec / sayAs from the cue when unset", () => {
    const result = validateBuild(
      draft({ recurring: [recurring({ endSec: "  ", sayAs: "  " })] }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const cue = result.build.recurring?.[0];
      expect(cue).toEqual({ startSec: 162, intervalSec: 29, say: "注卵" });
      expect(cue && "endSec" in cue).toBe(false);
      expect(cue && "sayAs" in cue).toBe(false);
    }
  });

  it("keeps endSec and sayAs when set, parsing mm:ss", () => {
    const result = validateBuild(
      draft({
        recurring: [
          recurring({
            startSec: "2:42",
            intervalSec: "0:29",
            endSec: "8:00",
            sayAs: " 女王补卵 ",
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.build.recurring?.[0]).toEqual({
        startSec: 162,
        intervalSec: 29,
        endSec: 480,
        say: "注卵",
        sayAs: "女王补卵",
      });
    }
  });
});
