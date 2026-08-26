/**
 * Provider-agnostic try-on contracts. The app talks to TryOnService only;
 * Higgsfield/FASHN/Kling live behind the TryOnProvider interface.
 *
 * CONTRACT: exported names and shapes here are pinned; extend, don't break.
 */

import type { GarmentCategory } from '@fitcheck/higgsfield';

export type { GarmentCategory };

export type TryOnProviderName = 'higgsfield' | 'fashn' | 'kling' | 'mock';

export interface TryOnRequest {
  person: {
    /** Higgsfield Soul avatar id (preferred once onboarded). */
    soulId?: string;
    /** Direct person photo fallback. */
    imageUrl?: string;
    /** Bump when the user re-onboards; part of the cache key. */
    avatarVersion?: number;
  };
  garment: {
    imageUrl: string;
    category: GarmentCategory;
    /** Catalog id, when the garment came from the feed. */
    productId?: string;
  };
  userId: string;
  /** Try-on session id — also used as the affiliate subid session. */
  sessionId: string;
}

export interface ProviderRenderOutput {
  imageUrl: string;
  previewUrl?: string;
  durationMs: number;
}

export interface TryOnRender extends ProviderRenderOutput {
  /** Deterministic render id — also the cache key. */
  id: string;
  provider: TryOnProviderName;
  costUsd: number;
  /** True when served from cache (cost 0 this time). */
  cached: boolean;
  createdAt: string;
  productId?: string;
}

export interface TryOnProvider {
  readonly name: TryOnProviderName;
  readonly costPerRenderUsd: number;
  supports(category: GarmentCategory): boolean;
  render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput>;
}

/** One line in the render-cost log. */
export interface CostRecord {
  renderId: string;
  provider: TryOnProviderName;
  costUsd: number;
  cached: boolean;
  userId: string;
  sessionId: string;
  productId?: string;
  at: string;
}

export interface RenderCache {
  get(key: string): Promise<TryOnRender | undefined>;
  set(key: string, render: TryOnRender): Promise<void>;
}

export interface TryOnServiceOptions {
  /** Ordered by preference; the router picks per category, then falls through on errors. */
  providers: TryOnProvider[];
  /** Per-category quality routing, e.g. { dress: 'higgsfield', top: 'fashn' }. */
  routing?: Partial<Record<GarmentCategory, TryOnProviderName>>;
  cache?: RenderCache;
  /** Cost-discipline hook: every render (cached or not) logs through this. */
  onCost?: (record: CostRecord) => void;
  /** Try the next supporting provider when one fails. Default true. */
  fallbackOnError?: boolean;
}
