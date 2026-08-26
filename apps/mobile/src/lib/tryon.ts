/**
 * The app's configured try-on service.
 *
 * Demo mode (default): MockTryOnProvider resolves bundled fit images with a
 * realistic render delay, so the whole loop works offline with zero spend.
 *
 * Real mode: set EXPO_PUBLIC_FITCHECK_API_URL to a FitCheck server that holds
 * the Higgsfield key pair. The Higgsfield key/secret NEVER ships in the app —
 * see packages/higgsfield/src/client.ts.
 */

import { getProductById } from '@fitcheck/catalog';
import {
  MockTryOnProvider,
  TryOnService,
  renderCacheKey,
  type RenderCache,
  type TryOnRender,
  type TryOnRequest,
} from '@fitcheck/tryon';

import { assetRef } from '@/lib/images';
import { RealHiggsfieldProvider, higgsfieldCredentials } from '@/lib/realProvider';
import { useStore } from '@/state/store';

/** Stable demo mapping: featured garment → matching generated fit image. */
const FIT_BY_IMAGE_KEY: Record<string, string> = {
  'p01-trench': 'fit-trench',
  'p02-leather': 'fit-leather',
  'p03-denim': 'fit-denim',
  'p07-slip-dress': 'fit-slip',
  'p08-knit-midi': 'fit-knit',
  'p10-black-mini': 'fit-mini',
};

const OUTERWEAR_FITS = ['fit-trench', 'fit-leather', 'fit-denim'] as const;
const DRESS_FITS = ['fit-slip', 'fit-knit', 'fit-mini'] as const;

function stableIndex(seed: string, length: number): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  return hash % length;
}

function resolveDemoFit(request: TryOnRequest): string {
  const product = request.garment.productId ? getProductById(request.garment.productId) : undefined;
  const mapped = product?.imageKey ? FIT_BY_IMAGE_KEY[product.imageKey] : undefined;
  if (mapped) return assetRef(mapped);

  const pool =
    request.garment.category === 'dress' || product?.category === 'dress'
      ? DRESS_FITS
      : OUTERWEAR_FITS;
  const seed = request.garment.productId ?? request.garment.imageUrl;
  const pick = pool[stableIndex(seed, pool.length)] ?? pool[0]!;
  return assetRef(pick);
}

/** Renders persist in the zustand store, so the cache survives restarts. */
const storeRenderCache: RenderCache = {
  async get(key: string): Promise<TryOnRender | undefined> {
    return useStore.getState().renders[key];
  },
  async set(key: string, render: TryOnRender): Promise<void> {
    useStore.getState().cacheRender(key, render);
  },
};

/** Feels like a real render (~5s) without being annoying in dev. */
const DEMO_RENDER_DELAY_MS = 4_800;

const demoProvider = new MockTryOnProvider({
  resolveImage: resolveDemoFit,
  delayMs: DEMO_RENDER_DELAY_MS,
});

/**
 * Real renders first when dev credentials are present (.env), demo renders as
 * the safety net — a failing API call falls through instead of breaking the app.
 */
const credentials = higgsfieldCredentials();
export const tryOnService = new TryOnService({
  providers: credentials
    ? [new RealHiggsfieldProvider(credentials), demoProvider]
    : [demoProvider],
  fallbackOnError: true,
  cache: storeRenderCache,
  onCost: (record) => useStore.getState().logCost(record),
});

/** Build the request for a catalog product try-on. */
export function requestForProduct(productId: string): TryOnRequest {
  const product = getProductById(productId);
  if (!product) throw new Error(`Unknown product: ${productId}`);
  const { userId, sessionId, avatar } = useStore.getState();
  return {
    person: {
      soulId: avatar.soulId,
      imageUrl: avatar.localUri ?? (avatar.imageKey ? assetRef(avatar.imageKey) : undefined),
      avatarVersion: avatar.version,
    },
    garment: {
      imageUrl: product.imageKey ? assetRef(product.imageKey) : (product.imageUrl ?? ''),
      category: product.category === 'dress' ? 'dress' : 'outerwear',
      productId: product.id,
    },
    userId,
    sessionId,
  };
}

/** Build the request for a pasted product URL try-on. */
export function requestForPastedUrl(imageUrl: string): TryOnRequest {
  const { userId, sessionId, avatar } = useStore.getState();
  return {
    person: {
      soulId: avatar.soulId,
      imageUrl: avatar.localUri ?? (avatar.imageKey ? assetRef(avatar.imageKey) : undefined),
      avatarVersion: avatar.version,
    },
    garment: { imageUrl, category: 'auto' },
    userId,
    sessionId,
  };
}

export { renderCacheKey };
