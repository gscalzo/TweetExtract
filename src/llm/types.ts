export interface SummaryResult {
  summary: string;
  tags: string[];
  rawResponse: string;
}

export interface Summarizer {
  summarize(text: string): Promise<SummaryResult>;
}
