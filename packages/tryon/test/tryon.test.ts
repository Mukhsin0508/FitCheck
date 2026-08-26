import { describe, expect, it, vi } from 'vitest';
import { HiggsfieldClient } from '@fitcheck/higgsfield';
import {
  FashnProvider,
  HiggsfieldTryOnProvider,
  InMemoryRenderCache,
  KlingProvider,
  MockTryOnProvider,
  renderCacheKey,
  TryOnService,
  type CostRecord,
  type TryOnRequest,
} from '../src/index';

function makeRequest(overrides: Partial<TryOnRequest> = {}): TryOnRequest {
  return {
    person: { soulId: 'soul_1', avatarVersion: 1, ...(overrides.person ?? {}) },
    garment: {
      imageUrl: 'https://cdn.example.com/dress.jpg',
      category: 'dress',
      productId: 'prod_1',
      ...(overrides.garment ?? {}),
    },
    userId: overrides.userId ?? 'user_1',
    sessionId: overrides.sessionId ?? 'sess_1',
  };
}

const mockProvider = (name: string, opts: Partial<ConstructorParameters<typeof MockTryOnProvider>[0]> = {}) =>
  new MockTryOnProvider({
    resolveImage: () => `https://renders.example.com/${name}.jpg`,
    ...opts,
  });

describe('renderCacheKey', () => {
  it('is deterministic for identical inputs', () => {
    expect(renderCacheKey(makeRequest())).toBe(renderCacheKey(makeRequest()));
  });

  it('changes when avatarVersion is bumped', () => {
    const before = renderCacheKey(makeRequest());
    const after = renderCacheKey(makeRequest({ person: { soulId: 'soul_1', avatarVersion: 2 } }));
    expect(after).not.toBe(before);
  });

  it('changes when the garment or user differs', () => {
    const base = renderCacheKey(makeRequest());
    expect(
      renderCacheKey(makeRequest({ garment: { imageUrl: 'https://cdn.example.com/top.jpg', category: 'top' } })),
    ).not.toBe(base);
    expect(renderCacheKey(makeRequest({ userId: 'user_2' }))).not.toBe(base);
  });

  it('ignores sessionId (same look, new session, same key)', () => {
    expect(renderCacheKey(makeRequest({ sessionId: 'sess_other' }))).toBe(renderCacheKey(makeRequest()));
  });
});

describe('MockTryOnProvider', () => {
  it('returns the resolved image', async () => {
    const provider = new MockTryOnProvider({
      resolveImage: (req) => `https://renders.example.com/${req.garment.category}.jpg`,
    });
    const out = await provider.render(makeRequest());
    expect(out.imageUrl).toBe('https://renders.example.com/dress.jpg');
    expect(provider.costPerRenderUsd).toBe(0);
  });

  it('falls back to fallbackImage when resolveImage returns undefined', async () => {
    const provider = new MockTryOnProvider({
      resolveImage: () => undefined,
      fallbackImage: 'https://renders.example.com/fallback.jpg',
    });
    const out = await provider.render(makeRequest());
    expect(out.imageUrl).toBe('https://renders.example.com/fallback.jpg');
  });

  it('throws when failFor matches', async () => {
    const provider = mockProvider('x', { failFor: () => true });
    await expect(provider.render(makeRequest())).rejects.toThrow('simulated failure');
  });
});

describe('TryOnService routing', () => {
  it('routes per category via options.routing', async () => {
    const higgs = mockProvider('higgsfield');
    Object.defineProperty(higgs, 'name', { value: 'higgsfield' });
    const fashn = mockProvider('fashn');
    Object.defineProperty(fashn, 'name', { value: 'fashn' });

    const service = new TryOnService({
      providers: [higgs, fashn],
      routing: { dress: 'fashn' },
    });

    const dress = await service.tryOn(makeRequest());
    expect(dress.provider).toBe('fashn');
    expect(dress.imageUrl).toBe('https://renders.example.com/fashn.jpg');

    const top = await service.tryOn(
      makeRequest({ garment: { imageUrl: 'https://cdn.example.com/top.jpg', category: 'top' } }),
    );
    expect(top.provider).toBe('higgsfield');
  });

  it('ignores routing when the routed provider does not support the category', async () => {
    const picky = mockProvider('kling');
    Object.defineProperty(picky, 'name', { value: 'kling' });
    picky.supports = (c) => c === 'top';
    const general = mockProvider('higgsfield');
    Object.defineProperty(general, 'name', { value: 'higgsfield' });

    const service = new TryOnService({
      providers: [general, picky],
      routing: { dress: 'kling' },
    });
    const render = await service.tryOn(makeRequest());
    expect(render.provider).toBe('higgsfield');
  });

  it('throws when no provider supports the category', async () => {
    const picky = mockProvider('mock');
    picky.supports = () => false;
    const service = new TryOnService({ providers: [picky] });
    await expect(service.tryOn(makeRequest())).rejects.toThrow(/No try-on provider supports/);
  });
});

describe('TryOnService fallback', () => {
  it('falls through to the next supporting provider on error', async () => {
    const flaky = mockProvider('higgsfield', { failFor: () => true });
    Object.defineProperty(flaky, 'name', { value: 'higgsfield' });
    const backup = mockProvider('fashn');
    Object.defineProperty(backup, 'name', { value: 'fashn' });

    const costs: CostRecord[] = [];
    const service = new TryOnService({ providers: [flaky, backup], onCost: (r) => costs.push(r) });
    const render = await service.tryOn(makeRequest());
    expect(render.provider).toBe('fashn');
    expect(render.cached).toBe(false);
    expect(costs).toHaveLength(1);
  });

  it('rethrows immediately when fallbackOnError is false', async () => {
    const flaky = mockProvider('a', { failFor: () => true });
    const backup = mockProvider('b');
    const service = new TryOnService({
      providers: [flaky, backup],
      fallbackOnError: false,
    });
    await expect(service.tryOn(makeRequest())).rejects.toThrow('simulated failure');
  });

  it('rethrows the last error when every provider fails', async () => {
    const a = mockProvider('a', { failFor: () => true });
    const b = new MockTryOnProvider({
      resolveImage: () => {
        throw new Error('b exploded');
      },
    });
    const service = new TryOnService({ providers: [a, b] });
    await expect(service.tryOn(makeRequest())).rejects.toThrow('b exploded');
  });
});

describe('TryOnService caching + cost log', () => {
  it('caches renders and serves hits with cached:true and costUsd 0', async () => {
    const provider = mockProvider('mock');
    const renderSpy = vi.spyOn(provider, 'render');
    const costs: CostRecord[] = [];
    const cache = new InMemoryRenderCache();
    const service = new TryOnService({ providers: [provider], cache, onCost: (r) => costs.push(r) });

    const first = await service.tryOn(makeRequest());
    expect(first.cached).toBe(false);
    expect(first.costUsd).toBe(0);
    expect(first.id).toBe(renderCacheKey(makeRequest()));
    expect(cache.size).toBe(1);

    const second = await service.tryOn(makeRequest());
    expect(second.cached).toBe(true);
    expect(second.costUsd).toBe(0);
    expect(second.imageUrl).toBe(first.imageUrl);
    expect(renderSpy).toHaveBeenCalledTimes(1);

    expect(costs).toHaveLength(2);
    expect(costs[1]).toMatchObject({
      renderId: first.id,
      costUsd: 0,
      cached: true,
      userId: 'user_1',
      sessionId: 'sess_1',
      productId: 'prod_1',
    });
  });

  it('re-renders after an avatarVersion bump (new cache key)', async () => {
    const provider = mockProvider('mock');
    const renderSpy = vi.spyOn(provider, 'render');
    const service = new TryOnService({ providers: [provider], cache: new InMemoryRenderCache() });

    await service.tryOn(makeRequest());
    const bumped = await service.tryOn(makeRequest({ person: { soulId: 'soul_1', avatarVersion: 2 } }));
    expect(bumped.cached).toBe(false);
    expect(renderSpy).toHaveBeenCalledTimes(2);
  });

  it('logs the provider cost on a fresh render', async () => {
    const hf = HiggsfieldClient.mock();
    const provider = new HiggsfieldTryOnProvider(hf, { poll: { initialDelayMs: 0, delayMs: 1 } });
    const costs: CostRecord[] = [];
    const service = new TryOnService({ providers: [provider], onCost: (r) => costs.push(r) });

    const render = await service.tryOn(
      makeRequest({ person: { imageUrl: 'https://cdn.example.com/me.jpg', avatarVersion: 1 } }),
    );
    expect(render.costUsd).toBe(0.09);
    expect(costs[0]).toMatchObject({ provider: 'higgsfield', costUsd: 0.09, cached: false });
  });
});

describe('HiggsfieldTryOnProvider', () => {
  it('renders end-to-end against HiggsfieldClient.mock()', async () => {
    const hf = HiggsfieldClient.mock();
    const provider = new HiggsfieldTryOnProvider(hf, { poll: { initialDelayMs: 0, delayMs: 1 } });
    expect(provider.supports('dress')).toBe(true);
    expect(provider.costPerRenderUsd).toBe(0.09);

    const out = await provider.render(
      makeRequest({ person: { imageUrl: 'https://cdn.example.com/me.jpg', avatarVersion: 1 } }),
    );
    expect(out.imageUrl).toMatch(/^https:\/\/mock\.higgsfield\.local\/renders\//);
    expect(out.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects a request with neither soulId nor person image', async () => {
    const provider = new HiggsfieldTryOnProvider(HiggsfieldClient.mock());
    const request: TryOnRequest = { ...makeRequest(), person: {} };
    await expect(provider.render(request)).rejects.toThrow(/soulId or person.imageUrl/);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('FashnProvider (provisional API shape)', () => {
  it('submits a run, polls to completion, and maps categories', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let polls = 0;
    const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === 'POST') return jsonResponse({ id: 'run_1' });
      polls += 1;
      return polls < 2
        ? jsonResponse({ id: 'run_1', status: 'processing' })
        : jsonResponse({ id: 'run_1', status: 'completed', output: ['https://cdn.fashn.ai/out.png'] });
    }) as unknown as typeof fetch;

    const provider = new FashnProvider({ apiKey: 'fa_test', fetch: fetchStub, pollIntervalMs: 0 });
    const out = await provider.render(
      makeRequest({ person: { imageUrl: 'https://cdn.example.com/me.jpg' } }),
    );

    expect(out.imageUrl).toBe('https://cdn.fashn.ai/out.png');
    const first = calls[0]!;
    expect(first.url).toBe('https://api.fashn.ai/v1/run');
    expect((first.init?.headers as Record<string, string>).Authorization).toBe('Bearer fa_test');
    const body = JSON.parse(String(first.init?.body));
    expect(body).toMatchObject({
      model_name: 'tryon-v1.6',
      inputs: { category: 'one-pieces', model_image: 'https://cdn.example.com/me.jpg' },
    });
    expect(calls[1]!.url).toBe('https://api.fashn.ai/v1/status/run_1');
  });

  it('throws on a failed run and when no person image exists', async () => {
    const fetchStub = vi.fn(async (_url: unknown, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({ id: 'run_2' })
        : jsonResponse({ id: 'run_2', status: 'failed', error: 'bad garment' }),
    ) as unknown as typeof fetch;
    const provider = new FashnProvider({ apiKey: 'fa_test', fetch: fetchStub, pollIntervalMs: 0 });

    await expect(
      provider.render(makeRequest({ person: { imageUrl: 'https://cdn.example.com/me.jpg' } })),
    ).rejects.toThrow(/failed/);
    await expect(provider.render(makeRequest())).rejects.toThrow(/person\.imageUrl/);
  });
});

describe('KlingProvider (provisional API shape)', () => {
  it('creates a task with a caller-signed JWT and polls to success', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    let polls = 0;
    const fetchStub = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      if (init?.method === 'POST') return jsonResponse({ code: 0, data: { task_id: 'task_1' } });
      polls += 1;
      return polls < 2
        ? jsonResponse({ code: 0, data: { task_status: 'processing' } })
        : jsonResponse({
            code: 0,
            data: { task_status: 'succeed', task_result: { images: [{ url: 'https://cdn.kling.ai/out.png' }] } },
          });
    }) as unknown as typeof fetch;

    const provider = new KlingProvider({
      getToken: async () => 'signed.jwt.token',
      fetch: fetchStub,
      pollIntervalMs: 0,
    });
    const out = await provider.render(
      makeRequest({ person: { imageUrl: 'https://cdn.example.com/me.jpg' } }),
    );

    expect(out.imageUrl).toBe('https://cdn.kling.ai/out.png');
    const first = calls[0]!;
    expect(first.url).toBe('https://api-singapore.klingai.com/v1/images/kolors-virtual-try-on');
    expect((first.init?.headers as Record<string, string>).Authorization).toBe('Bearer signed.jwt.token');
    expect(JSON.parse(String(first.init?.body))).toEqual({
      human_image: 'https://cdn.example.com/me.jpg',
      cloth_image: 'https://cdn.example.com/dress.jpg',
    });
    expect(calls[1]!.url).toContain('/kolors-virtual-try-on/task_1');
    expect(provider.costPerRenderUsd).toBe(0.07);
  });
});
