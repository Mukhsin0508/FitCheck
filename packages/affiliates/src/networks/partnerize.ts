import type { AffiliateProgram, Product } from '../schema';

export function buildPartnerizeUrl(product: Product, program: AffiliateProgram, subId: string): string {
  const camref = program.campaignRef ?? '';
  const destination = encodeURIComponent(product.productUrl);
  return `https://prf.hn/click/camref:${camref}/pubref:${encodeURIComponent(subId)}/destination:${destination}`;
}
