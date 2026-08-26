import { describe, expect, it } from "vitest";
import {
  STARS_CACHE_TTL_MS,
  formatCompactStars,
  parseStargazers,
  parseStarsCache,
} from "./stars";

describe("formatCompactStars", () => {
  it("keeps counts under 1000 as-is", () => {
    expect(formatCompactStars(0)).toBe("0");
    expect(formatCompactStars(42)).toBe("42");
    expect(formatCompactStars(999)).toBe("999");
  });

  it("compacts thousands with a lowercase suffix", () => {
    expect(formatCompactStars(1000)).toBe("1k");
    expect(formatCompactStars(1234)).toBe("1.2k");
    expect(formatCompactStars(12800)).toBe("12.8k");
    expect(formatCompactStars(2_400_000)).toBe("2.4m");
  });
});

describe("parseStarsCache", () => {
  const now = 1_700_000_000_000;

  it("returns a fresh cached count", () => {
    const raw = JSON.stringify({ count: 512, at: now - 1000 });
    expect(parseStarsCache(raw, now)).toBe(512);
  });

  it("rejects an expired entry", () => {
    const raw = JSON.stringify({ count: 512, at: now - STARS_CACHE_TTL_MS - 1 });
    expect(parseStarsCache(raw, now)).toBeNull();
  });

  it("rejects missing or malformed payloads", () => {
    expect(parseStarsCache(null, now)).toBeNull();
    expect(parseStarsCache("not json", now)).toBeNull();
    expect(parseStarsCache('"string"', now)).toBeNull();
    expect(parseStarsCache(JSON.stringify({ count: "512", at: now }), now)).toBeNull();
    expect(parseStarsCache(JSON.stringify({ count: 512 }), now)).toBeNull();
  });
});

describe("parseStargazers", () => {
  it("extracts a numeric stargazers_count", () => {
    expect(parseStargazers({ stargazers_count: 77 })).toBe(77);
  });

  it("returns null for anything else", () => {
    expect(parseStargazers(null)).toBeNull();
    expect(parseStargazers("nope")).toBeNull();
    expect(parseStargazers({})).toBeNull();
    expect(parseStargazers({ stargazers_count: "77" })).toBeNull();
  });
});
