/**
 * Subid codec: packs click attribution into a single clickref/u1/sid/pubref
 * value that affiliate networks echo back in postbacks.
 *
 * Format: 'v1.<userId>.<sessionId>.<productId>.<renderId|->'
 */

import type { ClickAttribution } from './schema';

const VERSION = 'v1';
/** Awin clickref hard cap; the strictest of our networks. */
const MAX_LENGTH = 99;
/** '-' marks an absent renderId so the segment count stays fixed. */
const EMPTY_SEGMENT = '-';

function sanitizeSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '');
}

export function encodeSubId(attribution: ClickAttribution): string {
  const segments = [
    sanitizeSegment(attribution.userId),
    sanitizeSegment(attribution.sessionId),
    sanitizeSegment(attribution.productId),
    attribution.renderId ? sanitizeSegment(attribution.renderId) || EMPTY_SEGMENT : EMPTY_SEGMENT,
  ];

  const overhead = VERSION.length + segments.length; // 'v1' + 4 dots
  const budget = MAX_LENGTH - overhead;
  const totalLen = segments.reduce((sum, s) => sum + s.length, 0);

  if (totalLen > budget) {
    // Proportional truncation: floor keeps the total within budget; keep at
    // least 1 char per non-empty segment so the subid stays decodeable.
    const scaled = segments.map((s) =>
      s.length === 0 ? s : s.slice(0, Math.max(1, Math.floor((s.length * budget) / totalLen))),
    );
    // Forced 1-char minimums can push the total past the budget; trim the
    // overflow from the longest segments (never below 1 char).
    let excess = scaled.reduce((sum, s) => sum + s.length, 0) - budget;
    while (excess > 0) {
      const i = scaled.reduce((max, s, j) => (s.length > (scaled[max]?.length ?? 0) ? j : max), 0);
      const longest = scaled[i];
      if (longest === undefined || longest.length <= 1) break; // cannot shrink further
      const cut = Math.min(excess, longest.length - 1);
      scaled[i] = longest.slice(0, longest.length - cut);
      excess -= cut;
    }
    return [VERSION, ...scaled].join('.');
  }

  return [VERSION, ...segments].join('.');
}

export function decodeSubId(subId: string): ClickAttribution | undefined {
  if (typeof subId !== 'string' || subId.length === 0 || subId.length > MAX_LENGTH) return undefined;
  const parts = subId.split('.');
  if (parts.length !== 5) return undefined;
  const [version, userId, sessionId, productId, renderId] = parts;
  if (version !== VERSION) return undefined;
  if (!userId || !sessionId || !productId || !renderId) return undefined;
  const segmentRe = /^[A-Za-z0-9_-]+$/;
  if (![userId, sessionId, productId, renderId].every((s) => segmentRe.test(s))) return undefined;
  const attribution: ClickAttribution = { userId, sessionId, productId };
  if (renderId !== EMPTY_SEGMENT) attribution.renderId = renderId;
  return attribution;
}
