import { describe, expect, it } from "vitest";
import type { BuildOrder } from "../types/build";
import {
  dueStepIndices,
  initialSpokenSet,
  nextStepIndex,
  previewSpokenSet,
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
