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
