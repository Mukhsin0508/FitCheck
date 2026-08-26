"use client";

import { useSyncExternalStore } from "react";
import { REPO_SLUG, REPO_URL } from "@/lib/site";
import { formatCompactStars, parseStargazers, parseStarsCache } from "@/lib/stars";

const CACHE_KEY = "fitcheck:stars";
// GitHub's unauthenticated API allows 60 requests/hour per IP; one poll a
// minute sits exactly on that budget, so failures just keep the last count.
const POLL_MS = 60 * 1000;

// One shared store: every star component on the page subscribes to the same
// count, one fetch serves them all, and one timer keeps it live.
let count: number | null = null;
let inflight = false;
let timer: number | null = null;
const listeners = new Set<() => void>();

function readCache(): number | null {
  try {
    return parseStarsCache(sessionStorage.getItem(CACHE_KEY), Date.now());
  } catch {
    return null;
  }
}

function writeCache(next: number): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ count: next, at: Date.now() }));
  } catch {
    // storage unavailable; skip caching
  }
}

async function refresh(): Promise<void> {
  if (inflight) return;
  inflight = true;
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_SLUG}`, {
      headers: { accept: "application/vnd.github+json" },
    });
    if (!res.ok) return;
    const next = parseStargazers(await res.json());
    if (next !== null && next !== count) {
      count = next;
      writeCache(next);
      for (const notify of listeners) notify();
    }
  } catch {
    // offline or rate-limited; keep showing the last known count
  } finally {
    inflight = false;
  }
}

function onVisibilityChange(): void {
  if (!document.hidden) void refresh();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  if (listeners.size === 1) {
    if (count === null) {
      const cached = readCache();
      if (cached !== null) {
        count = cached;
        for (const l of listeners) l();
      }
    }
    void refresh();
    timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(notify);
    if (listeners.size === 0 && timer !== null) {
      window.clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

export function useGitHubStars(): string | null {
  const stars = useSyncExternalStore(
    subscribe,
    () => count,
    () => null,
  );
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
