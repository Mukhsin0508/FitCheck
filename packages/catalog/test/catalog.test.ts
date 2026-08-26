import { describe, expect, it } from 'vitest';
import { parseFeed, productSchema } from '@fitcheck/affiliates';
import {
  DEMO_IMAGE_KEYS,
  categories,
  getFeaturedProducts,
  getProductById,
  getProductsByCategory,
  products,
} from '../src/index';
import { DRESS_IMAGE_KEYS, OUTERWEAR_IMAGE_KEYS } from '../src/featured';
import { generateProducts } from '../src/generate';

describe('@fitcheck/catalog', () => {
  it('seeds at least 200 products', () => {
    expect(products.length).toBeGreaterThanOrEqual(200);
  });

  it('every product passes productSchema (zero feed errors)', () => {
    const { errors } = parseFeed(products);
    expect(errors).toHaveLength(0);
    for (const p of products) {
      expect(productSchema.safeParse(p).success).toBe(true);
    }
  });

  it('ids are unique', () => {
    const ids = new Set(products.map((p) => p.id));
    expect(ids.size).toBe(products.length);
  });

  it('both categories have at least 80 items', () => {
    expect(products.filter((p) => p.category === 'outerwear').length).toBeGreaterThanOrEqual(80);
    expect(products.filter((p) => p.category === 'dress').length).toBeGreaterThanOrEqual(80);
    expect(categories.map((c) => c.id).sort()).toEqual(['dress', 'outerwear']);
  });

  it('all 12 featured products use valid bundled image keys and are featured', () => {
    const featured = getFeaturedProducts();
    expect(featured).toHaveLength(12);
    for (const p of featured) {
      expect(p.featured).toBe(true);
      expect(p.imageKey).toBeDefined();
      expect(DEMO_IMAGE_KEYS).toContain(p.imageKey as string);
    }
    // All 12 keys are covered, each exactly once.
    expect(new Set(featured.map((p) => p.imageKey)).size).toBe(12);
    expect(DEMO_IMAGE_KEYS).toHaveLength(12);
  });

  it('image keys stay within their category', () => {
    const outerwearKeys = new Set<string>(OUTERWEAR_IMAGE_KEYS);
    const dressKeys = new Set<string>(DRESS_IMAGE_KEYS);
    for (const p of products) {
      expect(p.imageKey).toBeDefined();
      const key = p.imageKey as string;
      if (p.category === 'outerwear') {
        expect(outerwearKeys.has(key)).toBe(true);
        expect(dressKeys.has(key)).toBe(false);
      } else {
        expect(dressKeys.has(key)).toBe(true);
        expect(outerwearKeys.has(key)).toBe(false);
      }
    }
  });

  it('getProductsByCategory filters correctly and "all" returns everything', () => {
    const outerwear = getProductsByCategory('outerwear');
    const dress = getProductsByCategory('dress');
    expect(outerwear.every((p) => p.category === 'outerwear')).toBe(true);
    expect(dress.every((p) => p.category === 'dress')).toBe(true);
    expect(outerwear.length + dress.length).toBe(products.length);
    expect(getProductsByCategory('all')).toHaveLength(products.length);
  });

  it('getProductById finds seeded items and misses unknown ids', () => {
    expect(getProductById('fc-owr-001')?.title).toBe('Sand Belted Trench Coat');
    expect(getProductById('fc-drs-012')?.imageKey).toBe('p12-emerald-maxi');
    expect(getProductById('nope')).toBeUndefined();
  });

  it('featured products come first', () => {
    expect(products.slice(0, 12).every((p) => p.featured === true)).toBe(true);
    expect(products.slice(12).every((p) => p.featured !== true)).toBe(true);
  });

  it('generation is deterministic', () => {
    const a = generateProducts();
    const b = generateProducts();
    expect(a).toEqual(b);
    expect(a).toHaveLength(204);
    // Repeat imports resolve to the same validated array.
    expect(getProductsByCategory('all')).toEqual(getProductsByCategory('all'));
  });

  it('prices and commissions are sane per merchant tier', () => {
    for (const p of products) {
      expect(Number.isInteger(p.priceCents)).toBe(true);
      expect(p.priceCents).toBeGreaterThanOrEqual(1800);
      expect(p.priceCents).toBeLessThanOrEqual(45000);
      expect(p.commissionPct).toBeGreaterThan(0);
      expect(p.commissionPct).toBeLessThanOrEqual(20);
      expect(p.currency).toBe('USD');
    }
  });
});
