import type { TryOnRequest } from './types';

/**
 * Deterministic cache key: same user + same person identity (soul or photo,
 * at a given avatar version) + same garment + category → same key.
 */
export function renderCacheKey(request: TryOnRequest): string {
  const person = request.person.soulId ?? request.person.imageUrl ?? '';
  const material = [
    request.userId,
    person,
    String(request.person.avatarVersion ?? 0),
    request.garment.imageUrl,
    request.garment.category,
  ].join('|');
  return `r_${fnv1a32(material, 0x811c9dc5)}${fnv1a32(material, 0x01000193)}`;
}

/** FNV-1a 32-bit, hex-encoded. Two seeds are concatenated for 64 bits of key space. */
function fnv1a32(input: string, seed: number): string {
  let hash = seed >>> 0;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    // hash *= 16777619 (FNV prime) using shifts to stay in 32-bit int math
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
