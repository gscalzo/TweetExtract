const UNIT_TO_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  mo: 30 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

export function parseDuration(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("--duration must be a non-empty string");
  }

  const match = /^([0-9]+(?:\.[0-9]+)?)([a-zA-Z]+)?$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration format: "${input}"`);
  }

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("--duration must be a positive number");
  }

  const unitRaw = (match[2] ?? "d").toLowerCase();
  const unit = unitRaw === "m" ? "m" : unitRaw;
  const multiplier = UNIT_TO_MS[unit];

  if (!multiplier) {
    const allowed = Object.keys(UNIT_TO_MS).join(", ");
    throw new Error(`Invalid duration unit "${unitRaw}". Allowed: ${allowed}.`);
  }

  return value * multiplier;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "unknown";
  }

  const units: Array<[string, number]> = [
    ["y", UNIT_TO_MS.y],
    ["mo", UNIT_TO_MS.mo],
    ["w", UNIT_TO_MS.w],
    ["d", UNIT_TO_MS.d],
    ["h", UNIT_TO_MS.h],
    ["m", UNIT_TO_MS.m],
    ["s", UNIT_TO_MS.s],
  ];

  for (const [unit, value] of units) {
    if (ms >= value) {
      return `${Math.round(ms / value)}${unit}`;
    }
  }

  return `${Math.round(ms)}ms`;
}
