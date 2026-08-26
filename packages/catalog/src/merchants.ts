import type { AffiliateNetworkId } from '@fitcheck/affiliates';

export interface MerchantMeta {
  programId: string;
  network: AffiliateNetworkId;
  /** [lo, hi] percent — generated commissionPct stays inside this. */
  commissionPctRange: [number, number];
  /** [min, max] cents — generated prices stay inside this tier. */
  priceRangeCents: [number, number];
  productUrl: (slug: string, n: number) => string;
}

export const MERCHANTS: readonly MerchantMeta[] = [
  {
    programId: 'shein',
    network: 'awin',
    commissionPctRange: [10, 20],
    priceRangeCents: [1800, 4500],
    productUrl: (slug, n) => `https://us.shein.com/${slug}-p-${10000000 + n}.html`,
  },
  {
    programId: 'hm',
    network: 'awin',
    commissionPctRange: [7, 10],
    priceRangeCents: [2500, 9000],
    productUrl: (_slug, n) => `https://www2.hm.com/en_us/productpage.${1200000000 + n}.html`,
  },
  {
    programId: 'asos',
    network: 'awin',
    commissionPctRange: [5, 8],
    priceRangeCents: [2500, 9000],
    productUrl: (slug, n) => `https://www.asos.com/us/fitcheck/${slug}/prd/${206000000 + n}`,
  },
  {
    programId: 'mango',
    network: 'rakuten',
    commissionPctRange: [4, 8],
    priceRangeCents: [2500, 9000],
    productUrl: (slug, n) => `https://shop.mango.com/us/women/${slug}_${87000000 + n}.html`,
  },
  {
    programId: 'farfetch',
    network: 'partnerize',
    commissionPctRange: [7, 13],
    priceRangeCents: [15000, 45000],
    productUrl: (slug, n) => `https://www.farfetch.com/shopping/women/${slug}-item-${19000000 + n}.aspx`,
  },
  {
    programId: 'reformation',
    network: 'cj',
    commissionPctRange: [6, 12],
    priceRangeCents: [15000, 45000],
    productUrl: (slug) => `https://www.thereformation.com/products/${slug}`,
  },
];
