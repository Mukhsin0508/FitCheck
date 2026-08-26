import { abortableDelay, throwIfAborted } from '../abort';
import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '../types';

export interface MockTryOnProviderOptions {
  /** Maps a request to a canned render URL; undefined falls through to fallbackImage. */
  resolveImage: (request: TryOnRequest) => string | undefined;
  fallbackImage?: string;
  delayMs?: number;
  /** Simulate a provider failure for matching requests (fallback tests). */
  failFor?: (request: TryOnRequest) => boolean;
}

/** Free, offline provider for demo mode and tests. */
export class MockTryOnProvider implements TryOnProvider {
  readonly name = 'mock' as const;
  readonly costPerRenderUsd = 0;

  constructor(private readonly options: MockTryOnProviderOptions) {}

  supports(_category: GarmentCategory): boolean {
    return true;
  }

  async render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput> {
    throwIfAborted(options?.signal);
    const startedAt = Date.now();
    if (this.options.failFor?.(request)) {
      throw new Error('MockTryOnProvider: simulated failure');
    }
    const delayMs = this.options.delayMs ?? 0;
    if (delayMs > 0) {
      await abortableDelay(delayMs, options?.signal);
    }
    const imageUrl = this.options.resolveImage(request) ?? this.options.fallbackImage;
    if (!imageUrl) {
      throw new Error('MockTryOnProvider: no image resolved and no fallbackImage set');
    }
    return { imageUrl, durationMs: Date.now() - startedAt };
  }
}
