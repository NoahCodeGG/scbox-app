import { describe, expect, it } from "vitest";
import {
  SECONDS_PER_SUPPLY,
  START_SUPPLY,
  supplyToTime,
} from "./supplyTime";

describe("supplyToTime", () => {
  it("maps the starting supply (and below) to time 0", () => {
    expect(supplyToTime(START_SUPPLY)).toBe(0);
    expect(supplyToTime(START_SUPPLY - 5)).toBe(0);
    expect(supplyToTime(0)).toBe(0);
  });

  it("scales linearly above the starting supply", () => {
    expect(supplyToTime(START_SUPPLY + 1)).toBe(SECONDS_PER_SUPPLY);
    expect(supplyToTime(START_SUPPLY + 2)).toBe(2 * SECONDS_PER_SUPPLY);
  });

  it("rounds fractional supply to whole seconds", () => {
    expect(supplyToTime(START_SUPPLY + 0.5)).toBe(
      Math.round(0.5 * SECONDS_PER_SUPPLY),
    );
  });

  it("returns 0 for non-finite input", () => {
    expect(supplyToTime(Number.NaN)).toBe(0);
    expect(supplyToTime(Number.POSITIVE_INFINITY)).toBe(0);
  });
});
