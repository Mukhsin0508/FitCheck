import { describe, expect, it } from 'vitest';
import { decodeSubId, encodeSubId } from '../src/subid';

describe('subid codec', () => {
  it('round-trips full attribution', () => {
    const attribution = { userId: 'u123', sessionId: 's456', productId: 'p789', renderId: 'r000' };
    const subId = encodeSubId(attribution);
    expect(subId).toBe('v1.u123.s456.p789.r000');
    expect(decodeSubId(subId)).toEqual(attribution);
  });

  it('round-trips missing renderId as "-"', () => {
    const attribution = { userId: 'u1', sessionId: 's1', productId: 'p1' };
    const subId = encodeSubId(attribution);
    expect(subId).toBe('v1.u1.s1.p1.-');
    expect(decodeSubId(subId)).toEqual({ userId: 'u1', sessionId: 's1', productId: 'p1' });
    expect(decodeSubId(subId)?.renderId).toBeUndefined();
  });

  it('sanitizes segments to [A-Za-z0-9_-]', () => {
    const subId = encodeSubId({
      userId: 'u.1@x',
      sessionId: 's 2!',
      productId: 'p/3#',
      renderId: 'r:4$',
    });
    expect(subId).toBe('v1.u1x.s2.p3.r4');
    expect(decodeSubId(subId)).toEqual({ userId: 'u1x', sessionId: 's2', productId: 'p3', renderId: 'r4' });
  });

  it('caps total length at 99 chars via proportional truncation', () => {
    const long = 'a'.repeat(80);
    const subId = encodeSubId({ userId: long, sessionId: long, productId: long, renderId: long });
    expect(subId.length).toBeLessThanOrEqual(99);
    expect(subId.startsWith('v1.')).toBe(true);
    const decoded = decodeSubId(subId);
    expect(decoded).toBeDefined();
    expect(decoded?.userId.length).toBeGreaterThan(0);
    // Equal inputs truncate to roughly equal shares.
    expect(decoded?.sessionId.length).toBe(decoded?.userId.length);
  });

  it('stays within 99 chars when forced 1-char minimums would overshoot', () => {
    // One huge segment + tiny siblings: the 1-char floors used to push the
    // total to 100, which decodeSubId itself rejects.
    const attribution = { userId: 'u'.repeat(150), sessionId: 's', productId: 'p' };
    const subId = encodeSubId(attribution);
    expect(subId.length).toBeLessThanOrEqual(99);
    const decoded = decodeSubId(subId);
    expect(decoded).toBeDefined();
    // Truncated ids won't equal the originals, but every segment must be a
    // prefix of what was encoded.
    expect(attribution.userId.startsWith(decoded!.userId)).toBe(true);
    expect(attribution.sessionId.startsWith(decoded!.sessionId)).toBe(true);
    expect(attribution.productId.startsWith(decoded!.productId)).toBe(true);
    expect(decoded?.renderId).toBeUndefined();
  });

  it('keeps short subids untouched', () => {
    const subId = encodeSubId({ userId: 'u', sessionId: 's', productId: 'p', renderId: 'r' });
    expect(subId).toBe('v1.u.s.p.r');
  });

  it('decode returns undefined for malformed input, never throws', () => {
    expect(decodeSubId('')).toBeUndefined();
    expect(decodeSubId('garbage')).toBeUndefined();
    expect(decodeSubId('v2.a.b.c.d')).toBeUndefined();
    expect(decodeSubId('v1.a.b.c')).toBeUndefined();
    expect(decodeSubId('v1.a.b.c.d.e')).toBeUndefined();
    expect(decodeSubId('v1..b.c.d')).toBeUndefined();
    expect(decodeSubId('v1.a$.b.c.d')).toBeUndefined();
    expect(decodeSubId('v1.' + 'a'.repeat(200) + '.b.c.d')).toBeUndefined();
  });
});
