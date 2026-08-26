import { describe, expect, it } from 'vitest';
import type { AffiliateProgram, Product } from '../src/schema';
import { buildAwinUrl } from '../src/networks/awin';
import { buildRakutenUrl } from '../src/networks/rakuten';
import { buildCjUrl } from '../src/networks/cj';
import { buildPartnerizeUrl } from '../src/networks/partnerize';
import { buildDirectUrl } from '../src/networks/direct';

const PRODUCT_URL = 'https://shop.example.com/dress?color=red&size=m';

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    title: 'Trench Coat',
    brand: 'Acme',
    programId: 'acme',
    network: 'awin',
    category: 'outerwear',
    priceCents: 12900,
    currency: 'USD',
    productUrl: PRODUCT_URL,
    commissionPct: 10,
    ...overrides,
  };
}

function program(overrides: Partial<AffiliateProgram> = {}): AffiliateProgram {
  return {
    id: 'acme',
    merchantName: 'Acme',
    network: 'awin',
    commissionPctRange: [10, 20],
    cookieWindowDays: 30,
    advertiserId: 'ADV1',
    publisherId: 'PUB1',
    campaignRef: 'CAM1',
    ...overrides,
  };
}

const SUB_ID = 'v1.u1.s1.p1.r1';

describe('network URL builders', () => {
  it('awin: cread.php with awinmid/awinaffid/clickref/ued', () => {
    const url = new URL(buildAwinUrl(product(), program(), SUB_ID));
    expect(url.origin + url.pathname).toBe('https://www.awin1.com/cread.php');
    expect(url.searchParams.get('awinmid')).toBe('ADV1');
    expect(url.searchParams.get('awinaffid')).toBe('PUB1');
    expect(url.searchParams.get('clickref')).toBe(SUB_ID);
    expect(url.searchParams.get('ued')).toBe(PRODUCT_URL);
  });

  it('rakuten: linksynergy deeplink with id/mid/u1/murl', () => {
    const url = new URL(buildRakutenUrl(product(), program(), SUB_ID));
    expect(url.origin + url.pathname).toBe('https://click.linksynergy.com/deeplink');
    expect(url.searchParams.get('id')).toBe('PUB1');
    expect(url.searchParams.get('mid')).toBe('ADV1');
    expect(url.searchParams.get('u1')).toBe(SUB_ID);
    expect(url.searchParams.get('murl')).toBe(PRODUCT_URL);
  });

  it('cj: click-<pid>-<aid> path with sid/url', () => {
    const url = new URL(buildCjUrl(product(), program(), SUB_ID));
    expect(url.origin).toBe('https://www.anrdoezrs.net');
    expect(url.pathname).toBe('/click-PUB1-ADV1');
    expect(url.searchParams.get('sid')).toBe(SUB_ID);
    expect(url.searchParams.get('url')).toBe(PRODUCT_URL);
  });

  it('partnerize: camref/pubref/destination path segments with encoded destination', () => {
    const raw = buildPartnerizeUrl(product(), program(), SUB_ID);
    expect(raw).toBe(
      `https://prf.hn/click/camref:CAM1/pubref:${SUB_ID}/destination:${encodeURIComponent(PRODUCT_URL)}`,
    );
    expect(raw).not.toContain('destination:https://shop'); // destination must be encoded
  });

  it('direct: appends ref/subid preserving existing query params', () => {
    const url = new URL(buildDirectUrl(product(), program({ network: 'direct' }), SUB_ID));
    expect(url.origin + url.pathname).toBe('https://shop.example.com/dress');
    expect(url.searchParams.get('color')).toBe('red');
    expect(url.searchParams.get('size')).toBe('m');
    expect(url.searchParams.get('ref')).toBe('fitcheck');
    expect(url.searchParams.get('subid')).toBe(SUB_ID);
  });
});
