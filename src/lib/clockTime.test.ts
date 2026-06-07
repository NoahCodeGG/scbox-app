import { describe, expect, it } from "vitest";
import { formatClockTime, parseClockTime } from "./clockTime";

describe("parseClockTime", () => {
  it("parses mm:ss into seconds", () => {
    expect(parseClockTime("3:55")).toBe(235);
    expect(parseClockTime("03:55")).toBe(235);
    expect(parseClockTime("0:17")).toBe(17);
  });

  it("parses plain seconds with no colon", () => {
    expect(parseClockTime("235")).toBe(235);
    expect(parseClockTime("0")).toBe(0);
  });

  it("rejects a seconds segment >= 60", () => {
    expect(parseClockTime("3:75")).toBeNull();
  });

  it("rejects garbage, negative, and empty input", () => {
    expect(parseClockTime("abc")).toBeNull();
    expect(parseClockTime("-5")).toBeNull();
    expect(parseClockTime("")).toBeNull();
  });
});

describe("formatClockTime", () => {
  it("zero-pads both segments and round-trips with parseClockTime", () => {
    expect(formatClockTime(235)).toBe("03:55");
    expect(formatClockTime(17)).toBe("00:17");
    expect(formatClockTime(0)).toBe("00:00");
    expect(parseClockTime(formatClockTime(235))).toBe(235);
  });
});
