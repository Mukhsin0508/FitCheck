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
import { ProxyTryOnProvider, tryOnProxyPath } from '@/lib/proxyProvider';
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

const FIT_POOLS: Record<string, readonly string[]> = {
  outerwear: ['fit-trench', 'fit-leather', 'fit-denim'],
  dress: ['fit-slip', 'fit-knit', 'fit-mini'],
  top: ['fit-shirt'],
  bottom: ['fit-trousers'],
};
const DEFAULT_POOL = FIT_POOLS['outerwear']!;

function stableIndex(seed: string, length: number): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  return hash % length;
}

function resolveDemoFit(request: TryOnRequest): string {
  const product = request.garment.productId ? getProductById(request.garment.productId) : undefined;
  const mapped = product?.imageKey ? FIT_BY_IMAGE_KEY[product.imageKey] : undefined;
  if (mapped) return assetRef(mapped);

  const category = product?.category ?? request.garment.category;
  const pool = FIT_POOLS[category] ?? DEFAULT_POOL;
  const seed = request.garment.productId ?? request.garment.imageUrl;
  const pick = pool[stableIndex(seed, pool.length)] ?? pool[0]!;
  return assetRef(pick);
}

/**
 * Renders persist in the zustand store, so the cache survives restarts.
 * Keys are namespaced by mode so demo renders never mask real ones.
 */
const proxyPath = tryOnProxyPath();
const cacheMode = higgsfieldCredentials() ? 'real' : proxyPath ? 'proxy' : 'demo';
const storeRenderCache: RenderCache = {
  async get(key: string): Promise<TryOnRender | undefined> {
    return useStore.getState().renders[`${cacheMode}:${key}`];
  },
  async set(key: string, render: TryOnRender): Promise<void> {
    // Outside demo mode a mock render means the API fell over (or the visitor
    // has no photo yet) — don't cache it, so the next attempt goes real again.
    if (cacheMode !== 'demo' && render.provider === 'mock') return;
    useStore.getState().cacheRender(`${cacheMode}:${key}`, render);
  },
};

/** Feels like a real render (~5s) without being annoying in dev. */
const DEMO_RENDER_DELAY_MS = 4_800;

const demoProvider = new MockTryOnProvider({
  resolveImage: resolveDemoFit,
  delayMs: DEMO_RENDER_DELAY_MS,
});

/**
 * Real renders first when available, demo renders as the safety net — a
 * failing call falls through instead of breaking the app. Direct credentials
 * (.env, native dev builds) win; the web embed goes through the render proxy,
 * which only takes visitors who onboarded with their own photos.
 */
const credentials = higgsfieldCredentials();
export const tryOnService = new TryOnService({
  providers: credentials
    ? [new RealHiggsfieldProvider(credentials), demoProvider]
    : proxyPath
      ? [new ProxyTryOnProvider(proxyPath), demoProvider]
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
      // Full-body beats the face portrait for dressing the whole person.
      imageUrl:
        avatar.fullBodyUri ??
        avatar.localUri ??
        (avatar.imageKey ? assetRef(avatar.imageKey) : undefined),
      avatarVersion: avatar.version,
    },
    garment: {
      imageUrl: product.imageKey ? assetRef(product.imageKey) : (product.imageUrl ?? ''),
      // CatalogCategory ('outerwear'|'dress'|'top'|'bottom') is a subset of GarmentCategory.
      category: product.category,
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
      imageUrl:
        avatar.fullBodyUri ??
        avatar.localUri ??
        (avatar.imageKey ? assetRef(avatar.imageKey) : undefined),
      avatarVersion: avatar.version,
    },
    garment: { imageUrl, category: 'auto' },
    userId,
    sessionId,
  };
}

export { renderCacheKey };
