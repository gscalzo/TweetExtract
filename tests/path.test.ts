import { describe, expect, it } from "vitest";
import { sanitizeReportName } from "../src/utils/path.js";

describe("sanitizeReportName", () => {
  it("replaces unsafe characters", () => {
    expect(sanitizeReportName("hello/world")).toBe("hello-world");
  });

  it("collapses repeated separators", () => {
    expect(sanitizeReportName("  my***report  ")).toBe("my-report");
  });

  it("falls back to report", () => {
    expect(sanitizeReportName("")).toBe("report");
  });
});
