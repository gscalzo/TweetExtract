# TweetExtract

Simple CLI to fetch your Twitter/X bookmarks with `@steipete/bird`, run a lightweight LLM summary (DeepSeek API), and generate a local HTML report.

## Setup

```bash
make install
```

Create a `.env` file with your DeepSeek key:

```bash
DEEPSEEK_API_KEY=your-key-here
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

## Usage

```bash
./run.sh bookmarks --count 50 --duration 14d --format markdown --out my-bookmarks
```

Or use the CLI directly (equivalent):

```bash
pnpm dev -- bookmarks --count 50 --duration 14d --format markdown --out my-bookmarks
```

The report is saved under `reports/<name>/report.md` with per-bookmark files under `reports/<name>/bookmarks/`.

## Privacy & Security (macOS Full Disk Access)

Reading browser cookies on macOS typically requires Full Disk Access for the terminal app you are running this tool from (e.g., Terminal, iTerm). Enable it once:

### macOS 13 Ventura / 14 Sonoma / 15 Sequoia

1. Open **System Settings**.
2. Go to **Privacy & Security**.
3. Click **Full Disk Access**.
4. Enable your terminal app (e.g., Terminal or iTerm).
5. Enter your password or use Touch ID if prompted.

### macOS 12 Monterey / 11 Big Sur

1. Open **System Preferences**.
2. Go to **Security & Privacy** → **Privacy**.
3. Select **Full Disk Access**.
4. Click the lock to unlock and add/enable your terminal app.

If you don’t see your terminal app, use the “+” button to add it from `/Applications`, then enable it.

### Credential options

By default, the tool tries to read cookies from Safari. You can override:

```bash
./run.sh bookmarks --cookie-source chrome
```

Or pass cookies manually:

```bash
./run.sh bookmarks --auth-token <value> --ct0 <value>
```

## Notes

- `--duration` accepts `h`, `d`, `w`, `mo`, `y` (e.g. `24h`, `7d`, `2w`).
- Increase `--count` if you need older bookmarks when using a long duration.
- Set `DEEPSEEK_API_KEY` in `.env` to enable summaries; use `--no-llm` to skip.
- `--format` accepts `markdown` (default) or `html`.
- Markdown reports include any image URLs discovered from tweet pages or direct links (no downloads).
