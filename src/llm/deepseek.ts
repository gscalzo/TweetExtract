import type { SummaryResult, Summarizer } from "./types.js";

export interface DeepSeekClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

export class DeepSeekClient implements Summarizer {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: DeepSeekClientOptions) {
    if (!options.apiKey?.trim()) {
      throw new Error("DeepSeek API key is required; set DEEPSEEK_API_KEY in .env");
    }
    this.apiKey = options.apiKey.trim();
    this.model = "deepseek-chat";
    this.baseUrl = (options.baseUrl?.trim() || "https://api.deepseek.com").replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs ?? 15_000;
  }

  async summarize(text: string): Promise<SummaryResult> {
    if (!text.trim()) {
      return { summary: "(empty)", tags: [], rawResponse: "" };
    }

    const systemPrompt = [
      "You are summarizing a bookmarked tweet or thread.",
      "Return JSON strictly in this format:",
      '{"summary":"one or two sentences","tags":["tag1","tag2"]}',
      "Rules:",
      "- summary should be concise (max 2 sentences).",
      "- tags should be 1-3 lowercase keywords.",
      "- Output JSON only, no extra text.",
      "- Output must be valid json.",
    ].join("\n\n");

    const payload = {
      model: this.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text.trim() },
      ],
      response_format: { type: "json_object" },
      max_tokens: 256,
      stream: false,
    } as const;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`DeepSeek error ${response.status}: ${detail}`);
      }

      const data = (await response.json()) as ChatCompletionResponse;
      if (data.error?.message) {
        throw new Error(`DeepSeek error: ${data.error.message}`);
      }
      const raw = data.choices?.[0]?.message?.content?.trim() ?? "";
      return this.parseResponse(raw);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private parseResponse(raw: string): SummaryResult {
    if (!raw) {
      return { summary: "(no response)", tags: [], rawResponse: raw };
    }

    const jsonCandidate = this.extractJson(raw);
    if (!jsonCandidate) {
      return { summary: raw, tags: [], rawResponse: raw };
    }

    try {
      const parsed = JSON.parse(jsonCandidate) as { summary?: unknown; tags?: unknown };
      const summary = typeof parsed.summary === "string" && parsed.summary.trim() ? parsed.summary.trim() : raw;
      const tags = Array.isArray(parsed.tags)
        ? parsed.tags.filter((tag) => typeof tag === "string").map((tag) => tag.trim()).filter(Boolean)
        : [];
      return { summary, tags, rawResponse: raw };
    } catch {
      return { summary: raw, tags: [], rawResponse: raw };
    }
  }

  private extractJson(raw: string): string | null {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      return null;
    }
    return raw.slice(start, end + 1);
  }
}
