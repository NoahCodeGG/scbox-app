import { describe, expect, it } from "vitest";
import type { BuildOrder } from "../types/build";
import {
  dueStepIndices,
  initialSpokenSet,
  nextStepIndex,
  triggerTime,
} from "./schedule";

const order: BuildOrder = {
  matchup: "TvX",
  race: "Terran",
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

describe("nextStepIndex", () => {
  it("returns the lowest unspoken index", () => {
    expect(nextStepIndex(order, new Set([0]))).toBe(1);
  });

  it("returns null when all steps are spoken", () => {
    expect(nextStepIndex(order, new Set([0, 1, 2]))).toBeNull();
  });
});
