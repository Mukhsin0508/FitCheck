"use client";

import { useEffect, useState } from "react";
import { REPO_SLUG, REPO_URL } from "@/lib/site";
import { formatCompactStars, parseStargazers, parseStarsCache } from "@/lib/stars";

const CACHE_KEY = "fitcheck:stars";

// Dedupes the request across the three components mounting at once.
let inflight: Promise<number | null> | null = null;

function readCache(): number | null {
  try {
    return parseStarsCache(sessionStorage.getItem(CACHE_KEY), Date.now());
  } catch {
    return null;
  }
}

function writeCache(count: number): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count, at: Date.now() }));
  } catch {
    // storage unavailable; skip caching
  }
}

function fetchStars(): Promise<number | null> {
  const cached = readCache();
  if (cached !== null) return Promise.resolve(cached);
  inflight ??= fetch(`https://api.github.com/repos/${REPO_SLUG}`)
    .then(async (res) => {
      if (!res.ok) return null;
      const count = parseStargazers(await res.json());
      if (count !== null) writeCache(count);
      return count;
    })
    .catch(() => null)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useGitHubStars(): string | null {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    void fetchStars().then((n) => {
      if (alive && n !== null) setStars(n);
    });
    return () => {
      alive = false;
    };
  }, []);
  return stars === null ? null : formatCompactStars(stars);
}

export function StarIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden className={className}>
      <path d="M8 .8l2.18 4.42 4.88.71-3.53 3.44.83 4.86L8 11.94l-4.36 2.29.83-4.86L.94 5.93l4.88-.71L8 .8z" />
    </svg>
  );
}

export function NavStarPill() {
  const stars = useGitHubStars();
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-center gap-2 text-sm"
    >
      <span className="text-muted transition-colors group-hover:text-foreground">
        GitHub
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-ink">
        <StarIcon className="h-3 w-3" />
        {stars ?? "Star"}
      </span>
    </a>
  );
}

export function HeroStarButton() {
  const stars = useGitHubStars();
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-2.5 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85"
    >
      <StarIcon className="h-4 w-4" />
      Star on GitHub
      {stars !== null && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-ink">
          {stars}
        </span>
      )}
    </a>
  );
}

export function RepoStarBadge() {
  const stars = useGitHubStars();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-sm font-medium text-ink">
      <StarIcon className="h-3.5 w-3.5" />
      {stars ?? "Star"}
    </span>
  );
}
