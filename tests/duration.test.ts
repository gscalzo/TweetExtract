import { describe, expect, it } from "vitest";
import { parseDuration, formatDuration } from "../src/utils/duration.js";

describe("duration", () => {
  it("parses duration with explicit unit", () => {
    expect(parseDuration("2h")).toBe(2 * 60 * 60 * 1000);
  });

  it("defaults to days when unit is missing", () => {
    expect(parseDuration("3")).toBe(3 * 24 * 60 * 60 * 1000);
  });

  it("formats duration with largest unit", () => {
    expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2h");
  });

  it("rejects invalid unit", () => {
    expect(() => parseDuration("5q")).toThrow(/Invalid duration unit/);
  });
});
