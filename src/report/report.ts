import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { escapeHtml, formatMultiline, truncate } from "../utils/text.js";
import { sanitizeReportName } from "../utils/path.js";

export interface ReportTweet {
  id: string;
  url: string;
  text: string;
  authorName: string;
  authorUsername: string;
  createdAt?: string;
}

export interface ReportItem {
  id: string;
  url: string;
  text: string;
  authorName: string;
  authorUsername: string;
  createdAt?: string;
  thread: ReportTweet[];
  summary?: string;
  tags?: string[];
}

export interface ReportMeta {
  generatedAt: string;
  source: string;
  count: number;
  duration?: string;
}

export interface ReportPayload {
  meta: ReportMeta;
  items: ReportItem[];
}

export type ReportFormat = "markdown" | "html";

export async function writeReport(
  payload: ReportPayload,
  options: { reportName: string; rootDir: string; format?: string; cookieHeader?: string },
) {
  const safeName = sanitizeReportName(options.reportName);
  const reportDir = join(options.rootDir, safeName);
  const format = normalizeFormat(options.format);

  await mkdir(reportDir, { recursive: true });

  await writeFile(join(reportDir, "report.json"), JSON.stringify(payload, null, 2));
  if (format === "markdown") {
    const markdown = await buildMarkdownReport(payload, {
      reportDir,
      cookieHeader: options.cookieHeader,
    });
    await writeFile(join(reportDir, "report.md"), markdown);
  } else {
    const tweetsDir = join(reportDir, "tweets");
    await mkdir(tweetsDir, { recursive: true });
    await writeFile(join(reportDir, "index.html"), buildIndexHtml(payload));
    for (const item of payload.items) {
      await writeFile(join(tweetsDir, `${item.id}.html`), buildTweetHtml(payload.meta, item));
    }
  }

  return { reportDir };
}

function normalizeFormat(input?: string): ReportFormat {
  const value = (input ?? "markdown").trim().toLowerCase();
  if (value === "markdown" || value === "md") {
    return "markdown";
  }
  if (value === "html") {
    return "html";
  }
  throw new Error(`Invalid --format value: ${input}. Allowed: markdown, html.`);
}

const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const MEDIA_URL_PATTERN =
  /https:\/\/pbs\.twimg\.com\/media\/[A-Za-z0-9_-]+(?:\.[A-Za-z0-9]+)?(?:\?[^\s"'<>]*)?/;
const MEDIA_URL_REGEX = new RegExp(MEDIA_URL_PATTERN.source, "g");
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|avif)(?:\?|$)/i;

async function buildMarkdownReport(
  payload: ReportPayload,
  options: { reportDir: string; cookieHeader?: string },
): Promise<string> {
  const lines: string[] = [];
  lines.push("# Bookmark Report");
  lines.push("");
  lines.push(`Generated: ${payload.meta.generatedAt}`);
  lines.push(`Count: ${payload.meta.count}`);
  if (payload.meta.duration) {
    lines.push(`Duration: ${payload.meta.duration}`);
  }
  lines.push("");

  const itemsDir = join(options.reportDir, "bookmarks");
  await mkdir(itemsDir, { recursive: true });
  lines.push("## Bookmarks");
  lines.push("");

  for (const item of payload.items) {
    const images = await collectImageUrls(item, {
      cookieHeader: options.cookieHeader,
    });
    const itemFilename = `${item.id}.md`;
    const itemMarkdown = buildMarkdownItem(item, images, {
      backLink: "../report.md",
    });
    await writeFile(join(itemsDir, itemFilename), itemMarkdown);

    const headline = item.summary ? item.summary : truncate(item.text, 120);
    const createdAt = item.createdAt ? ` · ${item.createdAt}` : "";
    lines.push(`- [@${item.authorUsername} — ${headline}](bookmarks/${itemFilename})${createdAt}`);
  }

  return lines.join("\n").trimEnd() + "\n";
}

function buildMarkdownItem(item: ReportItem, images: string[], options: { backLink?: string }): string {
  const lines: string[] = [];
  const headline = item.summary ? item.summary : truncate(item.text, 120);
  lines.push(`# @${item.authorUsername} — ${headline}`);
  if (options.backLink) {
    lines.push("");
    lines.push(`[Back to report](${options.backLink})`);
  }
  lines.push("");
  lines.push(`- URL: ${item.url}`);
  lines.push(`- Author: ${item.authorName} (@${item.authorUsername})`);
  if (item.createdAt) {
    lines.push(`- Created: ${item.createdAt}`);
  }
  if (item.tags?.length) {
    lines.push(`- Tags: ${item.tags.join(", ")}`);
  }
  lines.push("");

  if (item.summary) {
    lines.push("## Summary");
    lines.push(item.summary);
    lines.push("");
  }

  if (images.length > 0) {
    lines.push("## Images");
    images.forEach((image) => {
      lines.push(`- ${image}`);
    });
    lines.push("");
  }

  lines.push("## Thread");
  for (const tweet of item.thread) {
    const createdAt = tweet.createdAt ? ` · ${tweet.createdAt}` : "";
    lines.push(`- **@${tweet.authorUsername}**${createdAt}`);
    lines.push(`  ${indentMultiline(tweet.text)}`);
  }

  return lines.join("\n").trimEnd() + "\n";
}

function indentMultiline(text: string): string {
  return text.split("\n").map((line) => line.trimEnd()).join("\n  ");
}

function extractUrls(text: string): string[] {
  const matches = text.match(/\bhttps?:\/\/[^\s<>()]+/gi);
  if (!matches) {
    return [];
  }
  return matches.map((url) => url.replace(/[),.;!?]+$/g, ""));
}

async function collectImageUrls(
  item: ReportItem,
  options: { cookieHeader?: string },
): Promise<string[]> {
  const urls = new Set<string>();

  for (const tweet of item.thread) {
    for (const url of extractUrls(tweet.text)) {
      if (isLikelyImageUrl(url)) {
        urls.add(url);
      }
    }
  }

  const tweetIds = new Set(item.thread.map((tweet) => tweet.id));
  tweetIds.add(item.id);

  for (const tweetId of tweetIds) {
    const mediaUrls = await extractMediaUrlsFromTweetPage(tweetId, options.cookieHeader);
    mediaUrls.forEach((url) => urls.add(url));
  }

  return Array.from(urls);
}

async function extractMediaUrlsFromTweetPage(tweetId: string, cookieHeader?: string): Promise<string[]> {
  try {
    const response = await fetch(`https://x.com/i/status/${tweetId}`, {
      headers: {
        "user-agent": DEFAULT_USER_AGENT,
        ...(cookieHeader ? { cookie: cookieHeader } : {}),
      },
    });
    if (!response.ok) {
      return [];
    }
    const html = await response.text();
    const matches = html.match(MEDIA_URL_REGEX) ?? [];
    return Array.from(new Set(matches));
  } catch {
    return [];
  }
}

function isLikelyImageUrl(url: string): boolean {
  return MEDIA_URL_PATTERN.test(url) || IMAGE_EXTENSION_REGEX.test(url);
}

function buildIndexHtml(payload: ReportPayload): string {
  const itemsHtml = payload.items
    .map((item) => {
      const summary = item.summary || truncate(item.text, 180);
      const tags = item.tags?.length ? `<div class="tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";
      const createdAt = item.createdAt ? `<time>${escapeHtml(item.createdAt)}</time>` : "";
      return `
        <li>
          <div class="headline">
            <a class="title" href="tweets/${item.id}.html">${escapeHtml(summary)}</a>
            <a class="tweet-link" href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open on X</a>
          </div>
          <div class="meta">
            <span>@${escapeHtml(item.authorUsername)}</span>
            ${createdAt}
          </div>
          ${tags}
        </li>
      `;
    })
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TweetExtract Report</title>
  <style>
    body { font-family: "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif; margin: 0; background: #f6f6f8; color: #1b1b1f; }
    header { padding: 32px 24px; background: #111827; color: #f9fafb; }
    header h1 { margin: 0 0 8px; font-size: 26px; }
    header p { margin: 0; color: #c7d2fe; }
    main { max-width: 900px; margin: -24px auto 40px; padding: 0 20px; }
    .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); }
    ul { list-style: none; padding: 0; margin: 0; }
    li { padding: 16px 0; border-bottom: 1px solid #eef0f4; }
    li:last-child { border-bottom: none; }
    .headline { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 12px; }
    .title { font-weight: 600; color: #111827; text-decoration: none; }
    .title:hover { text-decoration: underline; }
    .tweet-link { font-size: 13px; color: #2563eb; text-decoration: none; }
    .meta { margin-top: 6px; font-size: 13px; color: #6b7280; display: flex; gap: 12px; }
    .tags { margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap; }
    .tags span { font-size: 12px; background: #eef2ff; color: #4338ca; padding: 4px 8px; border-radius: 999px; }
  </style>
</head>
<body>
  <header>
    <h1>Bookmark Report</h1>
    <p>Generated ${escapeHtml(payload.meta.generatedAt)} · ${payload.meta.count} items</p>
  </header>
  <main>
    <section class="card">
      <ul>
        ${itemsHtml}
      </ul>
    </section>
  </main>
</body>
</html>`;
}

function buildTweetHtml(meta: ReportMeta, item: ReportItem): string {
  const threadHtml = item.thread
    .map((tweet) => {
      const createdAt = tweet.createdAt ? `<time>${escapeHtml(tweet.createdAt)}</time>` : "";
      return `
        <article>
          <header>
            <strong>@${escapeHtml(tweet.authorUsername)}</strong>
            <span>${escapeHtml(tweet.authorName)}</span>
            ${createdAt}
          </header>
          <p>${formatMultiline(tweet.text)}</p>
        </article>
      `;
    })
    .join("\n");

  const summary = item.summary ? `<section class="summary"><h2>LLM Summary</h2><p>${formatMultiline(item.summary)}</p></section>` : "";
  const tags = item.tags?.length ? `<div class="tags">${item.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>` : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Tweet ${escapeHtml(item.id)}</title>
  <style>
    body { font-family: "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif; margin: 0; background: #f5f5f7; color: #111827; }
    header { padding: 24px; background: #0f172a; color: #e2e8f0; }
    header a { color: #93c5fd; text-decoration: none; }
    main { max-width: 860px; margin: -20px auto 40px; padding: 0 20px; }
    .card { background: #fff; border-radius: 16px; padding: 24px; box-shadow: 0 12px 24px rgba(15, 23, 42, 0.08); }
    .summary { margin-bottom: 20px; padding: 16px; border-radius: 12px; background: #eef2ff; }
    article { padding: 16px 0; border-bottom: 1px solid #eef0f4; }
    article:last-child { border-bottom: none; }
    article header { padding: 0 0 8px; background: none; color: #111827; display: flex; gap: 12px; align-items: baseline; flex-wrap: wrap; }
    article p { margin: 0; color: #1f2937; }
    .tags { margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap; }
    .tags span { font-size: 12px; background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 999px; }
  </style>
</head>
<body>
  <header>
    <div><strong>@${escapeHtml(item.authorUsername)}</strong> · ${escapeHtml(item.authorName)}</div>
    <div><a href="../index.html">Back to report</a> · <a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">Open on X</a></div>
  </header>
  <main>
    <section class="card">
      ${summary}
      ${tags}
      ${threadHtml}
    </section>
  </main>
</body>
</html>`;
}
