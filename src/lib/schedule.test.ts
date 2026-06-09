import { describe, expect, it } from "vitest";
import type { BuildOrder, RecurringCue } from "../types/build";
import {
  dueStepIndices,
  initialSpokenSet,
  lastDueOccurrence,
  nextRecurringTargetTime,
  nextStepIndex,
  previewSpokenSet,
  recurringTargetTime,
  triggerTime,
  upcomingStepIndices,
} from "./schedule";

const order: BuildOrder = {
  matchup: "TvX",
  race: "Terran",
  name: "test",
  leadTimeSec: 4,
  steps: [
    { time: 17, say: "补给站" }, // trigger at 13
    { time: 30, say: "兵营" }, // trigger at 26
    { time: 40, say: "精炼厂" }, // trigger at 36
  ],
};

describe("triggerTime", () => {
  it("subtracts lead time from the step time", () => {
    expect(triggerTime(order, 0)).toBe(13);
    expect(triggerTime(order, 1)).toBe(26);
  });
});

describe("dueStepIndices", () => {
  it("returns nothing before the lead window opens", () => {
    expect(dueStepIndices(order, 12, new Set())).toEqual([]);
  });

  it("marks a step due exactly at time - leadTimeSec", () => {
    expect(dueStepIndices(order, 13, new Set())).toEqual([0]);
  });

  it("does not repeat an already-spoken step", () => {
    const spoken = new Set([0]);
    expect(dueStepIndices(order, 13, spoken)).toEqual([]);
  });

  it("returns multiple steps whose triggers have all passed", () => {
    expect(dueStepIndices(order, 26, new Set())).toEqual([0, 1]);
  });

  it("returns only the unspoken passed steps", () => {
    expect(dueStepIndices(order, 36, new Set([0]))).toEqual([1, 2]);
  });
});

describe("initialSpokenSet (late-connect backlog suppression)", () => {
  it("is empty when connecting before any trigger", () => {
    expect([...initialSpokenSet(order, 0)]).toEqual([]);
  });

  it("suppresses steps whose trigger already passed on connect", () => {
    // Connect at 30s: triggers 13 and 26 passed, 36 not yet.
    expect([...initialSpokenSet(order, 30)].sort()).toEqual([0, 1]);
  });

  it("does not fire suppressed steps as due afterwards", () => {
    const seeded = initialSpokenSet(order, 30);
    expect(dueStepIndices(order, 30, seeded)).toEqual([]);
    // Only the genuinely-upcoming step fires once its trigger arrives.
    expect(dueStepIndices(order, 36, seeded)).toEqual([2]);
  });
});

describe("previewSpokenSet (Dashboard preview clock=0 short-circuit)", () => {
  // A build whose opening step is at time 0 — the regression this guards.
  const previewOrder: BuildOrder = {
    matchup: "TvX",
    race: "Terran",
    name: "preview",
    leadTimeSec: 4,
    steps: [
      { time: 0, say: "出兵营" }, // trigger at -4
      { time: 11, say: "补给站" }, // trigger at 7
    ],
  };

  it("returns an empty set when the clock is 0 (game not started)", () => {
    expect([...previewSpokenSet(previewOrder, 0)]).toEqual([]);
  });

  it("does not pre-mark a time-0 step as spoken at clock 0", () => {
    expect(previewSpokenSet(previewOrder, 0).has(0)).toBe(false);
  });

  it("returns an empty set for any non-positive clock", () => {
    expect([...previewSpokenSet(previewOrder, -5)]).toEqual([]);
  });

  it("matches initialSpokenSet once the clock is running", () => {
    // Clock 20: triggers -4 and 7 both passed → both steps spoken.
    expect([...previewSpokenSet(previewOrder, 20)].sort()).toEqual(
      [...initialSpokenSet(previewOrder, 20)].sort(),
    );
    // Mid-build with the existing 17/30/40 order: only step 0's trigger passed.
    expect([...previewSpokenSet(order, 20)].sort()).toEqual(
      [...initialSpokenSet(order, 20)].sort(),
    );
  });
});

describe("nextStepIndex", () => {
  it("returns the lowest unspoken index", () => {
    expect(nextStepIndex(order, new Set([0]))).toBe(1);
  });

  it("returns null when all steps are spoken", () => {
    expect(nextStepIndex(order, new Set([0, 1, 2]))).toBeNull();
  });
});

describe("upcomingStepIndices", () => {
  it("returns the next N unspoken indices in ascending order", () => {
    expect(upcomingStepIndices(order, new Set(), 2)).toEqual([0, 1]);
    expect(upcomingStepIndices(order, new Set([0]), 2)).toEqual([1, 2]);
  });

  it("returns fewer than count when not enough steps remain", () => {
    expect(upcomingStepIndices(order, new Set([0, 1]), 5)).toEqual([2]);
  });

  it("returns empty when all steps are spoken", () => {
    expect(upcomingStepIndices(order, new Set([0, 1, 2]), 3)).toEqual([]);
  });

  it("returns empty when count is non-positive", () => {
    expect(upcomingStepIndices(order, new Set(), 0)).toEqual([]);
    expect(upcomingStepIndices(order, new Set(), -1)).toEqual([]);
  });

  it("respects the spoken set and only returns unspoken indices", () => {
    expect(upcomingStepIndices(order, new Set([1]), 3)).toEqual([0, 2]);
  });
});

describe("recurring cues", () => {
  // start 60, every 30s, lead 4 → announce times 56, 86, 116, ...
  const inject: RecurringCue = { startSec: 60, intervalSec: 30, say: "注卵" };
  const lead = 4;

  describe("recurringTargetTime", () => {
    it("maps occurrence index to its display-time target", () => {
      expect(recurringTargetTime(inject, 0)).toBe(60);
      expect(recurringTargetTime(inject, 1)).toBe(90);
      expect(recurringTargetTime(inject, 3)).toBe(150);
    });
  });

  describe("lastDueOccurrence", () => {
    it("is null before the first announce time", () => {
      // First announce is 60 - 4 = 56.
      expect(lastDueOccurrence(inject, 55, lead)).toBeNull();
    });

    it("fires occurrence 0 exactly at startSec - leadTimeSec", () => {
      expect(lastDueOccurrence(inject, 56, lead)).toBe(0);
    });

    it("advances by interval as the clock passes each announce time", () => {
      expect(lastDueOccurrence(inject, 85, lead)).toBe(0); // before 86
      expect(lastDueOccurrence(inject, 86, lead)).toBe(1); // 90 - 4
      expect(lastDueOccurrence(inject, 200, lead)).toBe(4); // floor((200+4-60)/30)
    });

    it("reflects lead time: larger lead fires earlier", () => {
      expect(lastDueOccurrence(inject, 56, 0)).toBeNull(); // needs clock >= 60
      expect(lastDueOccurrence(inject, 60, 0)).toBe(0);
      expect(lastDueOccurrence(inject, 50, 10)).toBe(0); // 60 - 10
    });

    it("treats intervalSec <= 0 as invalid (never fires)", () => {
      const bad: RecurringCue = { startSec: 60, intervalSec: 0, say: "x" };
      expect(lastDueOccurrence(bad, 999, lead)).toBeNull();
      const neg: RecurringCue = { startSec: 60, intervalSec: -5, say: "x" };
      expect(lastDueOccurrence(neg, 999, lead)).toBeNull();
    });

    describe("with endSec", () => {
      // start 60, every 30s, endSec 150 → targets 60,90,120,150 (k 0..3).
      const capped: RecurringCue = {
        startSec: 60,
        intervalSec: 30,
        endSec: 150,
        say: "菌毯",
      };

      it("clamps to the last in-window occurrence past endSec", () => {
        // Clock far past end: latest target <= endSec is k=3 (150).
        expect(lastDueOccurrence(capped, 999, lead)).toBe(3);
      });

      it("still advances normally within the window", () => {
        expect(lastDueOccurrence(capped, 116, lead)).toBe(2); // 120 - 4
      });

      it("is null when even occurrence 0 is past endSec", () => {
        const tiny: RecurringCue = {
          startSec: 60,
          intervalSec: 30,
          endSec: 50,
          say: "x",
        };
        expect(lastDueOccurrence(tiny, 999, lead)).toBeNull();
      });
    });
  });

  describe("nextRecurringTargetTime", () => {
    it("returns the first target before anything has fired", () => {
      expect(nextRecurringTargetTime(inject, 0, lead)).toBe(60);
      expect(nextRecurringTargetTime(inject, 55, lead)).toBe(60);
    });

    it("returns the next target after the latest due occurrence", () => {
      expect(nextRecurringTargetTime(inject, 56, lead)).toBe(90); // fired 0
      expect(nextRecurringTargetTime(inject, 86, lead)).toBe(120); // fired 1
    });

    it("returns null once the next target would exceed endSec", () => {
      const capped: RecurringCue = {
        startSec: 60,
        intervalSec: 30,
        endSec: 150,
        say: "菌毯",
      };
      // After the last in-window occurrence (k=3, target 150), nothing more.
      expect(nextRecurringTargetTime(capped, 999, lead)).toBeNull();
      // Within window, the upcoming target is still produced.
      expect(nextRecurringTargetTime(capped, 116, lead)).toBe(150);
    });

    it("returns null for an invalid interval", () => {
      const bad: RecurringCue = { startSec: 60, intervalSec: 0, say: "x" };
      expect(nextRecurringTargetTime(bad, 100, lead)).toBeNull();
    });
  });
});
