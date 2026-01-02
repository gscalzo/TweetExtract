import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  resolveCredentials,
  TwitterClient,
  type CookieSource,
  type SearchResult,
  type TweetData,
} from "@steipete/bird";
import { DeepSeekClient } from "../llm/deepseek.js";
import type { Summarizer } from "../llm/types.js";
import { writeReport, type ReportItem, type ReportPayload } from "../report/report.js";
import { parseDuration, formatDuration } from "../utils/duration.js";

export interface BookmarksOptions {
  count: number;
  duration?: string;
  out?: string;
  llmEnabled: boolean;
  cookieSource: string;
  authToken?: string;
  ct0?: string;
  chromeProfile?: string;
  firefoxProfile?: string;
  timeoutMs?: number;
  quoteDepth?: number;
}

export async function runBookmarks(options: BookmarksOptions) {
  const count = normalizeCount(options.count);
  const durationMs = options.duration ? parseDuration(options.duration) : undefined;
  const cookieSources = parseCookieSources(options.cookieSource);
  const timeoutMs = normalizeTimeout(options.timeoutMs);
  const quoteDepth = normalizeQuoteDepth(options.quoteDepth);

  const { cookies, warnings } = await resolveCredentials({
    authToken: options.authToken,
    ct0: options.ct0,
    cookieSource: cookieSources,
    chromeProfile: options.chromeProfile,
    firefoxProfile: options.firefoxProfile,
  });

  for (const warning of warnings) {
    console.warn(`[warn] ${warning}`);
  }

  if (!cookies.authToken || !cookies.ct0) {
    throw new Error("Missing required cookies (authToken, ct0). Provide --auth-token/--ct0 or enable browser cookie extraction.");
  }

  const client = new TwitterClient({
    cookies,
    timeoutMs,
    quoteDepth,
  });

  const result = await client.getBookmarks(count);
  const tweets = unwrapTweets(result);
  const filtered = durationMs ? filterByDuration(tweets, durationMs) : tweets;

  let llm: Summarizer | null = null;
  if (options.llmEnabled) {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    llm = new DeepSeekClient({
      apiKey: deepseekApiKey ?? "",
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      timeoutMs,
    });
  }

  const items: ReportItem[] = [];
  for (const tweet of filtered) {
    const threadResult = await client.getThread(tweet.id);
    const threadTweets = threadResult.success && threadResult.tweets?.length ? threadResult.tweets : [tweet];
    const summaryText = buildSummaryInput(tweet, threadTweets);
    const analysis = llm ? await llm.summarize(summaryText) : null;

    items.push({
      id: tweet.id,
      url: tweetUrl(tweet),
      text: tweet.text,
      authorName: tweet.author.name,
      authorUsername: tweet.author.username,
      createdAt: tweet.createdAt,
      thread: threadTweets.map((threadTweet) => ({
        id: threadTweet.id,
        url: tweetUrl(threadTweet),
        text: threadTweet.text,
        authorName: threadTweet.author.name,
        authorUsername: threadTweet.author.username,
        createdAt: threadTweet.createdAt,
      })),
      summary: analysis?.summary,
      tags: analysis?.tags,
    });
  }

  const reportName = options.out || `bookmarks-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const reportsRoot = join(process.cwd(), "reports");
  await mkdir(reportsRoot, { recursive: true });

  const payload: ReportPayload = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: "bookmarks",
      count: items.length,
      duration: durationMs ? formatDuration(durationMs) : undefined,
    },
    items,
  };

  const { reportDir } = await writeReport(payload, { reportName, rootDir: reportsRoot });
  console.log(`Report saved to ${reportDir}`);
}

function normalizeCount(count: number): number {
  if (!Number.isFinite(count) || count <= 0) {
    throw new Error("--count must be a positive number");
  }
  return Math.floor(count);
}

function normalizeTimeout(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
}

function normalizeQuoteDepth(value?: number): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : undefined;
}

function parseCookieSources(input: string): CookieSource[] {
  const candidates = input
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (candidates.length === 0) {
    return ["safari"];
  }

  const allowed: CookieSource[] = ["safari", "chrome", "firefox"];
  const invalid = candidates.filter((value) => !allowed.includes(value as CookieSource));
  if (invalid.length > 0) {
    throw new Error(`Invalid --cookie-source value(s): ${invalid.join(", ")}. Allowed: safari, chrome, firefox.`);
  }

  return candidates as CookieSource[];
}


function unwrapTweets(result: SearchResult): TweetData[] {
  if (!result.success || !result.tweets) {
    throw new Error(`Failed to fetch bookmarks: ${result.error ?? "unknown error"}`);
  }
  return result.tweets;
}

function filterByDuration(tweets: TweetData[], durationMs: number): TweetData[] {
  const cutoff = Date.now() - durationMs;
  return tweets.filter((tweet) => {
    if (!tweet.createdAt) {
      return true;
    }
    const timestamp = Date.parse(tweet.createdAt);
    if (Number.isNaN(timestamp)) {
      return true;
    }
    return timestamp >= cutoff;
  });
}

function tweetUrl(tweet: TweetData): string {
  const username = tweet.author.username || "i";
  return `https://x.com/${username}/status/${tweet.id}`;
}

function buildSummaryInput(tweet: TweetData, thread: TweetData[]): string {
  const lines: string[] = [];
  lines.push(`Main tweet by @${tweet.author.username} (${tweet.author.name}):`);
  lines.push(tweet.text);

  if (thread.length > 1) {
    lines.push("\nThread:");
    for (const entry of thread) {
      lines.push(`@${entry.author.username}: ${entry.text}`);
    }
  }

  if (tweet.quotedTweet) {
    lines.push("\nQuoted tweet:");
    lines.push(`@${tweet.quotedTweet.author.username}: ${tweet.quotedTweet.text}`);
  }

  return lines.join("\n");
}
