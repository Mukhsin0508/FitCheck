import { renderCacheKey } from './cacheKey';
import type {
  GarmentCategory,
  RenderCache,
  TryOnProvider,
  TryOnRender,
  TryOnRequest,
  TryOnServiceOptions,
} from './types';

export class InMemoryRenderCache implements RenderCache {
  private readonly renders = new Map<string, TryOnRender>();

  async get(key: string): Promise<TryOnRender | undefined> {
    return this.renders.get(key);
  }

  async set(key: string, render: TryOnRender): Promise<void> {
    this.renders.set(key, render);
  }

  get size(): number {
    return this.renders.size;
  }

  clear(): void {
    this.renders.clear();
  }
}

/**
 * The app-facing try-on layer: cache first, per-category quality routing,
 * error fallback across providers, and a cost record for every render.
 */
export class TryOnService {
  constructor(private readonly options: TryOnServiceOptions) {
    if (options.providers.length === 0) {
      throw new TypeError('TryOnService needs at least one provider');
    }
  }

  async tryOn(
    request: TryOnRequest,
    opts?: { signal?: AbortSignal },
  ): Promise<TryOnRender> {
    const key = renderCacheKey(request);

    const cached = await this.options.cache?.get(key);
    if (cached) {
      this.logCost(request, cached.provider, key, 0, true);
      return { ...cached, cached: true, costUsd: 0 };
    }

    const candidates = this.candidatesFor(request.garment.category);
    if (candidates.length === 0) {
      throw new Error(`No try-on provider supports category "${request.garment.category}"`);
    }

    const fallbackOnError = this.options.fallbackOnError !== false;
    let lastError: unknown;
    for (const provider of candidates) {
      try {
        const output = await provider.render(request, opts);
        const render: TryOnRender = {
          ...output,
          id: key,
          provider: provider.name,
          costUsd: provider.costPerRenderUsd,
          cached: false,
          createdAt: new Date().toISOString(),
          productId: request.garment.productId,
        };
        await this.options.cache?.set(key, render);
        this.logCost(request, provider.name, key, provider.costPerRenderUsd, false);
        return render;
      } catch (error) {
        lastError = error;
        if (!fallbackOnError) throw error;
      }
    }
    throw lastError;
  }

  /** Routed provider first (when it supports the category), then the rest in configured order. */
  private candidatesFor(category: GarmentCategory): TryOnProvider[] {
    const supporting = this.options.providers.filter((p) => p.supports(category));
    const routedName = this.options.routing?.[category];
    if (routedName) {
      const routed = supporting.find((p) => p.name === routedName);
      if (routed) {
        return [routed, ...supporting.filter((p) => p !== routed)];
      }
    }
    return supporting;
  }

  private logCost(
    request: TryOnRequest,
    provider: TryOnRender['provider'],
    renderId: string,
    costUsd: number,
    cached: boolean,
  ): void {
    this.options.onCost?.({
      renderId,
      provider,
      costUsd,
      cached,
      userId: request.userId,
      sessionId: request.sessionId,
      productId: request.garment.productId,
      at: new Date().toISOString(),
    });
  }
}
