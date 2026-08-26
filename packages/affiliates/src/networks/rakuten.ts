import type { AffiliateProgram, Product } from '../schema';

export function buildRakutenUrl(product: Product, program: AffiliateProgram, subId: string): string {
  const url = new URL('https://click.linksynergy.com/deeplink');
  url.searchParams.set('id', program.publisherId ?? '');
  url.searchParams.set('mid', program.advertiserId ?? '');
  url.searchParams.set('u1', subId);
  url.searchParams.set('murl', product.productUrl);
  return url.toString();
}
