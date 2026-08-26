/**
 * Normalized affiliate-commerce schema. Every network feed (Awin, Rakuten, CJ,
 * Partnerize, direct programs) is ingested into these shapes — the app never
 * sees network-specific fields.
 *
 * CONTRACT: exported names and shapes here are pinned; extend, don't break.
 */

import { z } from 'zod';

/** Networks FitCheck integrates. */
export type AffiliateNetworkId = 'awin' | 'rakuten' | 'cj' | 'partnerize' | 'direct';

/** Browse categories in v1. Maps 1:1 onto try-on garment categories. */
export type CatalogCategory = 'outerwear' | 'dress' | 'top' | 'bottom';

export interface AffiliateProgram {
  /** Stable slug, e.g. 'shein', 'hm', 'farfetch', 'asos'. */
  id: string;
  merchantName: string;
  network: AffiliateNetworkId;
  /** Expected commission range in percent, e.g. [10, 20]. */
  commissionPctRange: [number, number];
  /** Attribution window in days. FitCheck prioritizes 30-day programs. */
  cookieWindowDays: number;
  /** Network-side merchant/advertiser id (awinmid, mid, CJ advertiser…). */
  advertiserId?: string;
  /** Our publisher/affiliate id on that network (awinaffid, LS id, PID…). */
  publisherId?: string;
  /** Partnerize campaign ref (camref). */
  campaignRef?: string;
}

export interface Product {
  /** Stable catalog id, unique across merchants. */
  id: string;
  title: string;
  brand: string;
  /** AffiliateProgram.id this product belongs to. */
  programId: string;
  network: AffiliateNetworkId;
  category: CatalogCategory;
  priceCents: number;
  /** ISO 4217, e.g. 'USD'. */
  currency: string;
  /** Merchant product page (raw, before deep-linking). */
  productUrl: string;
  /** Remote image URL (feed items). */
  imageUrl?: string;
  /** Bundled asset key for demo items, e.g. 'p01-trench'. */
  imageKey?: string;
  /** Expected commission percent for this item's program. */
  commissionPct: number;
  colors?: string[];
  sizes?: string[];
  /** Hand-picked hero items surface first in Browse. */
  featured?: boolean;
}

/** Everything we encode into the per-click subid for postback attribution. */
export interface ClickAttribution {
  userId: string;
  sessionId: string;
  productId: string;
  /** Try-on render that drove this click, when there was one. */
  renderId?: string;
}

/** A commission event parsed from a network postback. */
export interface PostbackEvent {
  network: AffiliateNetworkId;
  orderId: string;
  saleAmountCents: number;
  commissionCents: number;
  currency: string;
  /** Raw subid string exactly as the network echoed it. */
  subId: string;
  /** Decoded attribution, when the subid parses. */
  attribution?: ClickAttribution;
  status: 'pending' | 'confirmed' | 'declined';
  raw: Record<string, unknown>;
}

/* ------------------------------ feed ingestion ------------------------------ */

/** Tolerant feed-row schema: what per-network ingesters normalize into. */
export const productSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  brand: z.string().min(1),
  programId: z.string().min(1),
  network: z.enum(['awin', 'rakuten', 'cj', 'partnerize', 'direct']),
  category: z.enum(['outerwear', 'dress', 'top', 'bottom']),
  priceCents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  productUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'productUrl must be http(s)'),
  imageUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'imageUrl must be http(s)')
    .optional(),
  imageKey: z.string().optional(),
  commissionPct: z.number().nonnegative(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  featured: z.boolean().optional(),
});

export function parseProduct(row: unknown): Product {
  return productSchema.parse(row) as Product;
}

/** Validate a whole feed, returning good rows and per-row errors. */
export function parseFeed(rows: unknown[]): { products: Product[]; errors: { index: number; message: string }[] } {
  const products: Product[] = [];
  const errors: { index: number; message: string }[] = [];
  rows.forEach((row, index) => {
    const result = productSchema.safeParse(row);
    if (result.success) {
      products.push(result.data as Product);
    } else {
      errors.push({ index, message: result.error.issues.map((i) => i.message).join('; ') });
    }
  });
  return { products, errors };
}
