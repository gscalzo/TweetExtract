export function sanitizeReportName(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return "report";
  }

  const replaced = trimmed.replace(/[\\/]+/g, "-");
  const cleaned = replaced.replace(/[^a-zA-Z0-9._-]/g, "-");
  const collapsed = cleaned.replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "");

  return collapsed || "report";
}
