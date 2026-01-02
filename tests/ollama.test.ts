import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { OllamaClient } from "../src/llm/ollama.js";

const originalFetch = globalThis.fetch;

describe("OllamaClient", () => {
  beforeEach(() => {
    globalThis.fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => ({ response: '{"summary":"Test summary","tags":["tag"]}' }),
        text: async () => "",
      }) as Response;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("parses JSON response", async () => {
    const client = new OllamaClient({ model: "deepseek-r1:8b" });
    const result = await client.summarize("Hello");
    expect(result.summary).toBe("Test summary");
    expect(result.tags).toEqual(["tag"]);
  });
});
