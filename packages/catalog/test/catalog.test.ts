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
import {
  BOTTOM_IMAGE_KEYS,
  DRESS_IMAGE_KEYS,
  OUTERWEAR_IMAGE_KEYS,
  TOP_IMAGE_KEYS,
} from '../src/featured';
import { generateProducts } from '../src/generate';

const KEYS_BY_CATEGORY = {
  outerwear: new Set<string>(OUTERWEAR_IMAGE_KEYS),
  dress: new Set<string>(DRESS_IMAGE_KEYS),
  top: new Set<string>(TOP_IMAGE_KEYS),
  bottom: new Set<string>(BOTTOM_IMAGE_KEYS),
} as const;

describe('@fitcheck/catalog', () => {
  it('seeds at least 300 products', () => {
    expect(products.length).toBeGreaterThanOrEqual(300);
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

  it('all four categories have at least 50 items', () => {
    for (const category of ['outerwear', 'dress', 'top', 'bottom'] as const) {
      expect(products.filter((p) => p.category === category).length).toBeGreaterThanOrEqual(50);
    }
    expect(categories.map((c) => c.id).sort()).toEqual(['bottom', 'dress', 'outerwear', 'top']);
  });

  it('all 48 featured products use valid bundled image keys and are featured', () => {
    const featured = getFeaturedProducts();
    expect(featured).toHaveLength(48);
    for (const p of featured) {
      expect(p.featured).toBe(true);
      expect(p.imageKey).toBeDefined();
      expect(DEMO_IMAGE_KEYS).toContain(p.imageKey as string);
    }
    // All 48 keys are covered, each exactly once.
    expect(new Set(featured.map((p) => p.imageKey)).size).toBe(48);
    expect(DEMO_IMAGE_KEYS).toHaveLength(48);
  });

  it('image keys stay within their category across ALL items', () => {
    for (const p of products) {
      expect(p.imageKey).toBeDefined();
      const key = p.imageKey as string;
      expect(KEYS_BY_CATEGORY[p.category].has(key)).toBe(true);
      for (const [category, keys] of Object.entries(KEYS_BY_CATEGORY)) {
        if (category !== p.category) {
          expect(keys.has(key)).toBe(false);
        }
      }
    }
  });

  it('getProductsByCategory filters correctly and "all" returns everything', () => {
    const byCategory = (['outerwear', 'dress', 'top', 'bottom'] as const).map((c) =>
      getProductsByCategory(c),
    );
    for (const [i, category] of (['outerwear', 'dress', 'top', 'bottom'] as const).entries()) {
      expect(byCategory[i]?.every((p) => p.category === category)).toBe(true);
    }
    expect(byCategory.reduce((sum, list) => sum + list.length, 0)).toBe(products.length);
    expect(getProductsByCategory('all')).toHaveLength(products.length);
  });

  it('getProductById finds seeded items and misses unknown ids', () => {
    expect(getProductById('fc-owr-001')?.title).toBe('Sand Belted Trench Coat');
    expect(getProductById('fc-drs-012')?.imageKey).toBe('p12-emerald-maxi');
    expect(getProductById('fc-top-013')?.title).toBe('Crisp Poplin Button-Up');
    expect(getProductById('fc-btm-036')?.imageKey).toBe('p36-plaid-mini');
    expect(getProductById('nope')).toBeUndefined();
  });

  it('featured products come first', () => {
    expect(products.slice(0, 48).every((p) => p.featured === true)).toBe(true);
    expect(products.slice(48).every((p) => p.featured !== true)).toBe(true);
  });

  it('generation is deterministic', () => {
    const a = generateProducts();
    const b = generateProducts();
    expect(a).toEqual(b);
    expect(a).toHaveLength(304);
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
