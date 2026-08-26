import type { CatalogCategory, Product } from '@fitcheck/affiliates';
import { BOTTOM_IMAGE_KEYS, DRESS_IMAGE_KEYS, OUTERWEAR_IMAGE_KEYS, TOP_IMAGE_KEYS } from './featured';
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
  nouns: [
    'Wool Trench',
    'Leather Biker Jacket',
    'Denim Jacket',
    'Wool Overcoat',
    'Puffer Jacket',
    'Satin Bomber',
    'Wool Peacoat',
    'Teddy Coat',
    'Blazer',
    'Raincoat',
    'Suede Trucker Jacket',
    'Wool Overshirt',
  ],
  colors: ['Sand', 'Black', 'Camel', 'Olive', 'Stone Grey', 'Ecru', 'Espresso'],
  imageKeys: OUTERWEAR_IMAGE_KEYS,
};

const DRESS: CategoryMatrix = {
  adjectives: ['Bias-Cut', 'Ribbed', 'Wrap-Front', 'Structured', 'A-Line', 'Cowl-Neck', 'Smocked', 'Draped'],
  nouns: [
    'Satin Slip Dress',
    'Knit Midi Dress',
    'Floral Midi Dress',
    'Mini Dress',
    'Shirt Dress',
    'Maxi Dress',
    'Slip Midi Dress',
    'Broderie Sundress',
    'Tea Dress',
    'Knit Maxi Dress',
    'Sequin Mini Dress',
    'Tiered Midi Dress',
  ],
  colors: ['Champagne', 'Charcoal', 'Scarlet', 'Black', 'Ivory', 'Emerald', 'Dusty Rose'],
  imageKeys: DRESS_IMAGE_KEYS,
};

const TOP: CategoryMatrix = {
  adjectives: ['Crisp', 'Relaxed', 'Boxy', 'Fitted', 'Oversized', 'Cropped', 'Classic', 'Slouchy'],
  nouns: [
    'Poplin Button-Up',
    'Silk Blouse',
    'Breton Tee',
    'Cashmere Crewneck',
    'Cable-Knit Sweater',
    'Turtleneck Top',
    'Satin Camisole',
    'Heavyweight Tee',
    'Fine-Knit Cardigan',
    'Mohair Sweater',
    'Chambray Shirt',
    'Corset Top',
  ],
  colors: ['White', 'Black', 'Ivory', 'Grey Marl', 'Navy', 'Cream', 'Rust'],
  imageKeys: TOP_IMAGE_KEYS,
};

const BOTTOM: CategoryMatrix = {
  adjectives: ['High-Rise', 'Relaxed', 'Stretch', 'Cropped', 'Washed', 'Slim', 'Structured', 'Raw-Hem'],
  nouns: [
    'Straight-Leg Jeans',
    'Tailored Trousers',
    'Wide-Leg Trousers',
    'Pleated Midi Skirt',
    'Leather Midi Skirt',
    'Linen Trousers',
    'Flared Jeans',
    'Cargo Pants',
    'Bias Maxi Skirt',
    'Pencil Skirt',
    'Knit Joggers',
    'Wool Mini Skirt',
  ],
  colors: ['Indigo', 'Black', 'Beige', 'Grey', 'Chocolate', 'White', 'Khaki'],
  imageKeys: BOTTOM_IMAGE_KEYS,
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

interface GenerationRun {
  category: CatalogCategory;
  matrix: CategoryMatrix;
  idPrefix: string;
  /** Generated ids start at 101 so they never collide with featured 001–048. */
  idStart: number;
  merchantOffset: number;
  count: number;
}

const RUNS: readonly GenerationRun[] = [
  { category: 'outerwear', matrix: OUTERWEAR, idPrefix: 'fc-owr-', idStart: 101, merchantOffset: 0, count: 102 },
  { category: 'dress', matrix: DRESS, idPrefix: 'fc-drs-', idStart: 101, merchantOffset: 3, count: 102 },
  { category: 'top', matrix: TOP, idPrefix: 'fc-top-', idStart: 101, merchantOffset: 1, count: 50 },
  { category: 'bottom', matrix: BOTTOM, idPrefix: 'fc-btm-', idStart: 101, merchantOffset: 4, count: 50 },
];

/**
 * 304 deterministic catalog items: 102 outerwear (fc-owr-101…) + 102 dress
 * (fc-drs-101…) + 50 top (fc-top-101…) + 50 bottom (fc-btm-101…).
 */
export function generateProducts(): Product[] {
  const items: Product[] = [];
  for (const run of RUNS) {
    for (let i = 0; i < run.count; i++) {
      items.push(generateItem(run.category, run.matrix, run.idPrefix, run.idStart, run.merchantOffset, i));
    }
  }
  return items;
}
