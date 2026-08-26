import type { AffiliateProgram, Product } from '../schema';

export function buildAwinUrl(product: Product, program: AffiliateProgram, subId: string): string {
  const url = new URL('https://www.awin1.com/cread.php');
  url.searchParams.set('awinmid', program.advertiserId ?? '');
  url.searchParams.set('awinaffid', program.publisherId ?? '');
  url.searchParams.set('clickref', subId);
  url.searchParams.set('ued', product.productUrl);
  return url.toString();
}
