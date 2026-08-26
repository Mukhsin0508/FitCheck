import type { AffiliateProgram, ClickAttribution, Product } from './schema';
import { encodeSubId } from './subid';
import { buildAwinUrl } from './networks/awin';
import { buildRakutenUrl } from './networks/rakuten';
import { buildCjUrl } from './networks/cj';
import { buildPartnerizeUrl } from './networks/partnerize';
import { buildDirectUrl } from './networks/direct';

function requireIds(program: AffiliateProgram, keys: ('advertiserId' | 'publisherId' | 'campaignRef')[]): void {
  const missing = keys.filter((k) => !program[k]);
  if (missing.length > 0) {
    throw new Error(
      `Affiliate program '${program.id}' (${program.network}) is missing required ids: ${missing.join(', ')}`,
    );
  }
}

/** Build the outbound click URL for a product, with attribution packed into the subid. */
export function buildAffiliateUrl(
  product: Product,
  program: AffiliateProgram,
  attribution: ClickAttribution,
): string {
  const subId = encodeSubId(attribution);
  switch (program.network) {
    case 'awin':
      requireIds(program, ['advertiserId', 'publisherId']);
      return buildAwinUrl(product, program, subId);
    case 'rakuten':
      requireIds(program, ['advertiserId', 'publisherId']);
      return buildRakutenUrl(product, program, subId);
    case 'cj':
      requireIds(program, ['advertiserId', 'publisherId']);
      return buildCjUrl(product, program, subId);
    case 'partnerize':
      requireIds(program, ['campaignRef']);
      return buildPartnerizeUrl(product, program, subId);
    case 'direct':
      return buildDirectUrl(product, program, subId);
  }
}
