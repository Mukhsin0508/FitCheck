import { describe, expect, it } from 'vitest';
import type { AffiliateProgram, ClickAttribution, Product } from '../src/schema';
import { buildAffiliateUrl } from '../src/deeplink';
import { AFFILIATE_PROGRAMS, getProgram } from '../src/programs';

const attribution: ClickAttribution = { userId: 'u1', sessionId: 's1', productId: 'p1', renderId: 'r1' };
const SUB_ID = 'v1.u1.s1.p1.r1';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Dress',
    brand: 'Acme',
    programId: 'acme',
    network: 'awin',
    category: 'dress',
    priceCents: 4900,
    currency: 'USD',
    productUrl: 'https://shop.example.com/item',
    commissionPct: 10,
    ...overrides,
  };
}

describe('buildAffiliateUrl', () => {
  it('dispatches to the right builder per network', () => {
    const cases: [string, string][] = [
      ['shein', 'https://www.awin1.com/'],
      ['mango', 'https://click.linksynergy.com/'],
      ['reformation', 'https://www.anrdoezrs.net/'],
      ['farfetch', 'https://prf.hn/'],
    ];
    for (const [programId, prefix] of cases) {
      const url = buildAffiliateUrl(product(), getProgram(programId), attribution);
      expect(url.startsWith(prefix)).toBe(true);
      expect(url).toContain(encodeURIComponent(SUB_ID).replace(/%2E/g, '.'));
    }
  });

  it('handles direct programs without network ids', () => {
    const direct: AffiliateProgram = {
      id: 'house',
      merchantName: 'House Brand',
      network: 'direct',
      commissionPctRange: [15, 15],
      cookieWindowDays: 30,
    };
    const url = new URL(buildAffiliateUrl(product(), direct, attribution));
    expect(url.searchParams.get('subid')).toBe(SUB_ID);
    expect(url.searchParams.get('ref')).toBe('fitcheck');
  });

  it('throws a clear error when required ids are missing', () => {
    const broken: AffiliateProgram = {
      id: 'broken',
      merchantName: 'Broken',
      network: 'awin',
      commissionPctRange: [5, 10],
      cookieWindowDays: 30,
      advertiserId: '123',
      // publisherId missing
    };
    expect(() => buildAffiliateUrl(product(), broken, attribution)).toThrow(/publisherId/);

    const noCamref: AffiliateProgram = { ...broken, id: 'np', network: 'partnerize', advertiserId: undefined };
    expect(() => buildAffiliateUrl(product(), noCamref, attribution)).toThrow(/campaignRef/);
  });
});

describe('programs registry', () => {
  it('seeds the six launch programs with 30-day cookies', () => {
    const ids = ['shein', 'hm', 'farfetch', 'asos', 'mango', 'reformation'];
    for (const id of ids) {
      const p = getProgram(id);
      expect(p.id).toBe(id);
      expect(p.cookieWindowDays).toBe(30);
    }
    expect(Object.keys(AFFILIATE_PROGRAMS).sort()).toEqual([...ids].sort());
    expect(getProgram('farfetch').network).toBe('partnerize');
    expect(getProgram('mango').network).toBe('rakuten');
    expect(getProgram('reformation').network).toBe('cj');
  });

  it('getProgram throws on unknown id', () => {
    expect(() => getProgram('nope')).toThrow(/Unknown affiliate program/);
  });
});
