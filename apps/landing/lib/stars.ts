export type StarsCache = { count: number; at: number };

export const STARS_CACHE_TTL_MS = 10 * 60 * 1000;

export function formatCompactStars(n: number): string {
  if (n < 1000) return String(n);
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  })
    .format(n)
    .toLowerCase();
}

export function parseStarsCache(raw: string | null, now: number): number | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const { count, at } = parsed as { count?: unknown; at?: unknown };
  if (typeof count !== "number" || typeof at !== "number") return null;
  if (now - at > STARS_CACHE_TTL_MS) return null;
  return count;
}

export function parseStargazers(data: unknown): number | null {
  if (typeof data !== "object" || data === null) return null;
  const count = (data as { stargazers_count?: unknown }).stargazers_count;
  return typeof count === "number" ? count : null;
}
