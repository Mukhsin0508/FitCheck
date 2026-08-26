import type { AffiliateProgram, Product } from '../schema';

export function buildCjUrl(product: Product, program: AffiliateProgram, subId: string): string {
  const base = `https://www.anrdoezrs.net/click-${program.publisherId ?? ''}-${program.advertiserId ?? ''}`;
  const params = new URLSearchParams();
  params.set('sid', subId);
  params.set('url', product.productUrl);
  return `${base}?${params.toString()}`;
}
