import { describe, expect, it } from "vitest";
import { interpolate } from "./clock";

describe("interpolate", () => {
  it("returns the anchor when no wall time has elapsed", () => {
    expect(
      interpolate({
        anchorDisplayTime: 30,
        anchorAtMs: 1000,
        nowMs: 1000,
        paused: false,
      }),
    ).toBe(30);
  });

  it("advances with elapsed wall time (ms -> seconds)", () => {
    expect(
      interpolate({
        anchorDisplayTime: 30,
        anchorAtMs: 1000,
        nowMs: 1500,
        paused: false,
      }),
    ).toBe(30.5);
  });

  it("advances by whole seconds over a full poll interval", () => {
    expect(
      interpolate({
        anchorDisplayTime: 30,
        anchorAtMs: 1000,
        nowMs: 2000,
        paused: false,
      }),
    ).toBe(31);
  });

  it("freezes at the anchor when paused, ignoring elapsed wall time", () => {
    expect(
      interpolate({
        anchorDisplayTime: 42,
        anchorAtMs: 1000,
        nowMs: 5000,
        paused: true,
      }),
    ).toBe(42);
  });

  it("never goes below the anchor when the clock runs backward", () => {
    expect(
      interpolate({
        anchorDisplayTime: 30,
        anchorAtMs: 2000,
        nowMs: 1000,
        paused: false,
      }),
    ).toBe(30);
  });
});
