#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { runBookmarks } from "./commands/bookmarks.js";

const program = new Command();

program
  .name("tweet-extract")
  .description("Extract and analyze Twitter bookmarks.")
  .version("0.1.0");

program
  .command("bookmarks")
  .description("Fetch bookmarked tweets and generate a report")
  .option("--count <number>", "Number of bookmarks to fetch", "50")
  .option("--duration <duration>", "Only include tweets newer than duration (e.g. 7d, 24h, 2w)")
  .option("--out <name>", "Report folder name under ./reports")
  .option("--format <format>", "Report format (markdown or html)", "markdown")
  .option("--no-llm", "Skip LLM analysis")
  .option("--cookie-source <sources>", "Cookie sources (comma-separated: safari,chrome,firefox)", "safari")
  .option("--auth-token <token>", "Auth token cookie value")
  .option("--ct0 <token>", "CT0 cookie value")
  .option("--chrome-profile <name>", "Chrome profile name to read cookies from")
  .option("--firefox-profile <name>", "Firefox profile name to read cookies from")
  .option("--timeout-ms <ms>", "Twitter client timeout in ms", "15000")
  .option("--quote-depth <number>", "How deep to resolve quoted tweets", "2")
  .action(async (opts) => {
    try {
      await runBookmarks({
        count: Number(opts.count),
        duration: opts.duration,
        out: opts.out,
        format: opts.format,
        llmEnabled: opts.llm !== false,
        cookieSource: opts.cookieSource,
        authToken: opts.authToken,
        ct0: opts.ct0,
        chromeProfile: opts.chromeProfile,
        firefoxProfile: opts.firefoxProfile,
        timeoutMs: Number(opts.timeoutMs),
        quoteDepth: Number(opts.quoteDepth),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] ${message}`);
      process.exitCode = 1;
    }
  });

const argv = process.argv.slice();
const delimiterIndex = argv.indexOf("--");
if (delimiterIndex !== -1) {
  argv.splice(delimiterIndex, 1);
}

program.parseAsync(argv);
