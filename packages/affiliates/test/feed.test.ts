import { describe, expect, it } from 'vitest';
import { parseFeed } from '../src/schema';

const goodRow = {
  id: 'p01',
  title: 'Belted Trench',
  brand: 'Acme',
  programId: 'shein',
  network: 'awin',
  category: 'outerwear',
  priceCents: 12900,
  currency: 'USD',
  productUrl: 'https://shop.example.com/trench',
  commissionPct: 12,
  featured: true,
};

describe('parseFeed', () => {
  it('accepts valid rows', () => {
    const { products, errors } = parseFeed([goodRow]);
    expect(errors).toEqual([]);
    expect(products).toHaveLength(1);
    expect(products[0]?.id).toBe('p01');
    expect(products[0]?.featured).toBe(true);
  });

  it('collects per-row errors with indices and keeps good rows', () => {
    const bad1 = { ...goodRow, id: '', priceCents: -5 };
    const bad2 = { ...goodRow, network: 'unknown-network', productUrl: 'not a url' };
    const { products, errors } = parseFeed([bad1, goodRow, bad2, null]);
    expect(products).toHaveLength(1);
    expect(products[0]?.id).toBe('p01');
    expect(errors.map((e) => e.index)).toEqual([0, 2, 3]);
    expect(errors[0]?.message.length).toBeGreaterThan(0);
  });

  it('rejects non-http(s) productUrl schemes', () => {
    const jsRow = { ...goodRow, productUrl: 'javascript:alert(1)' };
    const fileRow = { ...goodRow, productUrl: 'file:///etc/passwd' };
    const { products, errors } = parseFeed([jsRow, fileRow, goodRow]);
    expect(products).toHaveLength(1);
    expect(products[0]?.productUrl).toBe(goodRow.productUrl);
    expect(errors.map((e) => e.index)).toEqual([0, 1]);
  });
});
