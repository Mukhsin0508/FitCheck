import type { CatalogCategory, Product } from '@fitcheck/affiliates';
import { DRESS_IMAGE_KEYS, OUTERWEAR_IMAGE_KEYS } from './featured';
import { MERCHANTS, type MerchantMeta } from './merchants';

// Deterministic by contract: index arithmetic only, no randomness.

const pick = <T>(arr: readonly T[], i: number): T => arr[i % arr.length] as T;

const BRANDS = [
  'Maren',
  'Ode Studio',
  'Arlo & Wren',
  'Calla Noir',
  'Solene',
  'Sable Row',
  'Fera',
  'Anouk',
  'Lumen Atelier',
  'Vesper Lane',
] as const;

interface CategoryMatrix {
  adjectives: readonly string[];
  /** Index-aligned with imageKeys so titles roughly match the reused image. */
  nouns: readonly string[];
  colors: readonly string[];
  imageKeys: readonly string[];
}

const OUTERWEAR: CategoryMatrix = {
  adjectives: ['Belted', 'Boxy Cropped', 'Oversized', 'Longline', 'Quilted', 'Double-Breasted', 'Relaxed', 'Tailored'],
  nouns: ['Wool Trench', 'Leather Biker Jacket', 'Denim Jacket', 'Wool Overcoat', 'Puffer Jacket', 'Satin Bomber'],
  colors: ['Sand', 'Black', 'Camel', 'Olive', 'Stone Grey', 'Ecru', 'Espresso'],
  imageKeys: OUTERWEAR_IMAGE_KEYS,
};

const DRESS: CategoryMatrix = {
  adjectives: ['Bias-Cut', 'Ribbed', 'Wrap-Front', 'Structured', 'Tiered', 'Cowl-Neck', 'Smocked', 'Draped'],
  nouns: ['Satin Slip Dress', 'Knit Midi Dress', 'Floral Midi Dress', 'Mini Dress', 'Shirt Dress', 'Maxi Dress'],
  colors: ['Champagne', 'Charcoal', 'Scarlet', 'Black', 'Ivory', 'Emerald', 'Dusty Rose'],
  imageKeys: DRESS_IMAGE_KEYS,
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// .99-style price inside the merchant tier; span is reduced so rounding up
// to .99 never exceeds the tier max.
function priceCentsFor(merchant: MerchantMeta, i: number): number {
  const [min, max] = merchant.priceRangeCents;
  const span = max - min - 99;
  const raw = min + ((i * 731) % span);
  return Math.floor(raw / 100) * 100 + 99;
}

function commissionPctFor(merchant: MerchantMeta, i: number): number {
  const [lo, hi] = merchant.commissionPctRange;
  return lo + (((i * 3) % ((hi - lo) * 2 + 1)) / 2);
}

function generateItem(
  category: CatalogCategory,
  matrix: CategoryMatrix,
  idPrefix: string,
  idStart: number,
  merchantOffset: number,
  i: number,
): Product {
  const adjective = pick(matrix.adjectives, i);
  const nounIndex = Math.floor(i / matrix.adjectives.length) % matrix.nouns.length;
  const noun = matrix.nouns[nounIndex] as string;
  const color = pick(matrix.colors, i * 5 + 2);
  const title = `${adjective} ${noun} in ${color}`;
  const merchant = pick(MERCHANTS, i + merchantOffset);
  const num = idStart + i;
  const id = `${idPrefix}${String(num).padStart(3, '0')}`;

  return {
    id,
    title,
    brand: pick(BRANDS, i * 3 + merchantOffset),
    programId: merchant.programId,
    network: merchant.network,
    category,
    priceCents: priceCentsFor(merchant, i),
    currency: 'USD',
    productUrl: merchant.productUrl(slugify(title), 100000 + num),
    imageKey: pick(matrix.imageKeys, nounIndex),
    commissionPct: commissionPctFor(merchant, i),
    colors: [color.toLowerCase()],
    sizes: i % 2 === 0 ? ['XS', 'S', 'M', 'L', 'XL'] : ['S', 'M', 'L'],
  };
}

const GENERATED_PER_CATEGORY = 102;

/** 204 deterministic catalog items: 102 outerwear (fc-owr-013…) + 102 dress (fc-drs-113…). */
export function generateProducts(): Product[] {
  const items: Product[] = [];
  for (let i = 0; i < GENERATED_PER_CATEGORY; i++) {
    items.push(generateItem('outerwear', OUTERWEAR, 'fc-owr-', 13, 0, i));
  }
  for (let i = 0; i < GENERATED_PER_CATEGORY; i++) {
    items.push(generateItem('dress', DRESS, 'fc-drs-', 113, 3, i));
  }
  return items;
}
