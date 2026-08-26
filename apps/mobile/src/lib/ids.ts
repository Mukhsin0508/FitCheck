/** Small id helpers that work on Hermes (no guaranteed crypto.randomUUID). */

export function generateId(prefix: string): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) return `${prefix}_${cryptoObj.randomUUID().replaceAll('-', '').slice(0, 20)}`;
  const rand = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
  return `${prefix}_${Date.now().toString(36)}${rand}`.slice(0, 24);
}
