import type { AffiliateProgram, Product } from '../schema';

/** Direct (in-house) program: tag the merchant URL, preserving existing params. */
export function buildDirectUrl(product: Product, _program: AffiliateProgram, subId: string): string {
  const url = new URL(product.productUrl);
  url.searchParams.set('ref', 'fitcheck');
  url.searchParams.set('subid', subId);
  return url.toString();
}
