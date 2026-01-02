import { describe, expect, it } from "vitest";
import { mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { writeReport, type ReportPayload } from "../src/report/report.js";

const ROOT = join(process.cwd(), ".tmp-tests");

describe("writeReport", () => {
  it("writes report files", async () => {
    await mkdir(ROOT, { recursive: true });

    const payload: ReportPayload = {
      meta: {
        generatedAt: "2026-01-02T10:00:00.000Z",
        source: "bookmarks",
        count: 1,
      },
      items: [
        {
          id: "123",
          url: "https://x.com/user/status/123",
          text: "Hello world",
          authorName: "User",
          authorUsername: "user",
          createdAt: "2026-01-01T10:00:00.000Z",
          thread: [
            {
              id: "123",
              url: "https://x.com/user/status/123",
              text: "Hello world",
              authorName: "User",
              authorUsername: "user",
              createdAt: "2026-01-01T10:00:00.000Z",
            },
          ],
          summary: "Greeting",
          tags: ["intro"],
        },
      ],
    };

    const { reportDir } = await writeReport(payload, { reportName: "test-report", rootDir: ROOT });
    const indexHtml = await readFile(join(reportDir, "index.html"), "utf8");
    const tweetHtml = await readFile(join(reportDir, "tweets", "123.html"), "utf8");
    const reportJson = await readFile(join(reportDir, "report.json"), "utf8");

    expect(indexHtml).toContain("Bookmark Report");
    expect(tweetHtml).toContain("Hello world");
    expect(reportJson).toContain("\"count\": 1");
  });
});
