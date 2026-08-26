/**
 * Bundled image registry. Catalog items and demo renders reference these by
 * key; `asset://<key>` pseudo-URLs from the mock try-on provider resolve here.
 */

import type { ImageSourcePropType } from 'react-native';

export const catalogImages: Record<string, ImageSourcePropType> = {
  'p01-trench': require('../../assets/catalog/p01-trench.jpg'),
  'p02-leather': require('../../assets/catalog/p02-leather.jpg'),
  'p03-denim': require('../../assets/catalog/p03-denim.jpg'),
  'p04-camel-coat': require('../../assets/catalog/p04-camel-coat.jpg'),
  'p05-puffer': require('../../assets/catalog/p05-puffer.jpg'),
  'p06-bomber': require('../../assets/catalog/p06-bomber.jpg'),
  'p07-slip-dress': require('../../assets/catalog/p07-slip-dress.jpg'),
  'p08-knit-midi': require('../../assets/catalog/p08-knit-midi.jpg'),
  'p09-floral-wrap': require('../../assets/catalog/p09-floral-wrap.jpg'),
  'p10-black-mini': require('../../assets/catalog/p10-black-mini.jpg'),
  'p11-linen-shirt': require('../../assets/catalog/p11-linen-shirt.jpg'),
  'p12-emerald-maxi': require('../../assets/catalog/p12-emerald-maxi.jpg'),
  'p13-poplin-shirt': require('../../assets/catalog/p13-poplin-shirt.jpg'),
  'p14-silk-blouse': require('../../assets/catalog/p14-silk-blouse.jpg'),
  'p15-breton-tee': require('../../assets/catalog/p15-breton-tee.jpg'),
  'p16-cashmere-crew': require('../../assets/catalog/p16-cashmere-crew.jpg'),
  'p17-cable-knit': require('../../assets/catalog/p17-cable-knit.jpg'),
  'p18-turtleneck': require('../../assets/catalog/p18-turtleneck.jpg'),
  'p19-satin-cami': require('../../assets/catalog/p19-satin-cami.jpg'),
  'p20-oversized-tee': require('../../assets/catalog/p20-oversized-tee.jpg'),
  'p21-navy-cardigan': require('../../assets/catalog/p21-navy-cardigan.jpg'),
  'p22-mohair-sweater': require('../../assets/catalog/p22-mohair-sweater.jpg'),
  'p23-chambray-shirt': require('../../assets/catalog/p23-chambray-shirt.jpg'),
  'p24-corset-top': require('../../assets/catalog/p24-corset-top.jpg'),
  'p25-straight-jeans': require('../../assets/catalog/p25-straight-jeans.jpg'),
  'p26-tailored-trousers': require('../../assets/catalog/p26-tailored-trousers.jpg'),
  'p27-wide-leg': require('../../assets/catalog/p27-wide-leg.jpg'),
  'p28-pleated-skirt': require('../../assets/catalog/p28-pleated-skirt.jpg'),
  'p29-leather-skirt': require('../../assets/catalog/p29-leather-skirt.jpg'),
  'p30-linen-trousers': require('../../assets/catalog/p30-linen-trousers.jpg'),
  'p31-flared-jeans': require('../../assets/catalog/p31-flared-jeans.jpg'),
  'p32-cargo-pants': require('../../assets/catalog/p32-cargo-pants.jpg'),
  'p33-satin-skirt': require('../../assets/catalog/p33-satin-skirt.jpg'),
  'p34-pencil-skirt': require('../../assets/catalog/p34-pencil-skirt.jpg'),
  'p35-knit-joggers': require('../../assets/catalog/p35-knit-joggers.jpg'),
  'p36-plaid-mini': require('../../assets/catalog/p36-plaid-mini.jpg'),
  'p37-peacoat': require('../../assets/catalog/p37-peacoat.jpg'),
  'p38-teddy-coat': require('../../assets/catalog/p38-teddy-coat.jpg'),
  'p39-grey-blazer': require('../../assets/catalog/p39-grey-blazer.jpg'),
  'p40-raincoat': require('../../assets/catalog/p40-raincoat.jpg'),
  'p41-suede-jacket': require('../../assets/catalog/p41-suede-jacket.jpg'),
  'p42-wool-overshirt': require('../../assets/catalog/p42-wool-overshirt.jpg'),
  'p43-black-slip': require('../../assets/catalog/p43-black-slip.jpg'),
  'p44-broderie-sundress': require('../../assets/catalog/p44-broderie-sundress.jpg'),
  'p45-polka-wrap': require('../../assets/catalog/p45-polka-wrap.jpg'),
  'p46-knit-maxi': require('../../assets/catalog/p46-knit-maxi.jpg'),
  'p47-sequin-mini': require('../../assets/catalog/p47-sequin-mini.jpg'),
  'p48-tiered-midi': require('../../assets/catalog/p48-tiered-midi.jpg'),
};

export const demoImages: Record<string, ImageSourcePropType> = {
  avatar: require('../../assets/demo/avatar.jpg'),
  fullbody: require('../../assets/demo/fullbody.jpg'),
  'fit-trench': require('../../assets/demo/fit-trench.jpg'),
  'fit-leather': require('../../assets/demo/fit-leather.jpg'),
  'fit-slip': require('../../assets/demo/fit-slip.jpg'),
  'fit-knit': require('../../assets/demo/fit-knit.jpg'),
  'fit-denim': require('../../assets/demo/fit-denim.jpg'),
  'fit-mini': require('../../assets/demo/fit-mini.jpg'),
  'fit-shirt': require('../../assets/demo/fit-shirt.jpg'),
  'fit-trousers': require('../../assets/demo/fit-trousers.jpg'),
};

const ASSET_PREFIX = 'asset://';

export function assetRef(key: string): string {
  return `${ASSET_PREFIX}${key}`;
}

/**
 * Turn a render/image ref into something <Image source> accepts:
 * `asset://fit-trench` → bundled asset, anything else → remote/local uri.
 */
export function resolveImageRef(ref: string): ImageSourcePropType {
  if (ref.startsWith(ASSET_PREFIX)) {
    const key = ref.slice(ASSET_PREFIX.length);
    const bundled = demoImages[key] ?? catalogImages[key];
    if (bundled) return bundled;
  }
  return { uri: ref };
}

/** Product card image: bundled key when present, remote URL otherwise. */
export function productImageSource(product: {
  imageKey?: string;
  imageUrl?: string;
}): ImageSourcePropType | undefined {
  if (product.imageKey && catalogImages[product.imageKey]) return catalogImages[product.imageKey];
  if (product.imageUrl) return { uri: product.imageUrl };
  return undefined;
}
