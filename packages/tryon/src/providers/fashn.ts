/**
 * PROVISIONAL — written against the publicly documented FASHN API shape
 * (POST /v1/run, poll GET /v1/status/{id}). Verify request/response fields
 * against https://docs.fashn.ai before production use.
 */

import { z } from 'zod';
import { abortError } from '../abort';
import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '../types';

export interface FashnProviderOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  /** Delay between status polls, ms. Default 1500. */
  pollIntervalMs?: number;
  /** Overall render deadline, ms. Default 120_000. */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://api.fashn.ai/v1';

const FASHN_CATEGORY: Record<GarmentCategory, string> = {
  top: 'tops',
  bottom: 'bottoms',
  dress: 'one-pieces',
  outerwear: 'tops',
  full_body: 'auto',
  auto: 'auto',
};

const runResponse = z.looseObject({ id: z.string() });

const statusResponse = z.looseObject({
  status: z.string(),
  output: z.array(z.string()).optional(),
  error: z.unknown().optional(),
});

export class FashnProvider implements TryOnProvider {
  readonly name = 'fashn' as const;
  readonly costPerRenderUsd = 0.075;

  private readonly fetch: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: FashnProviderOptions) {
    this.fetch = options.fetch ?? globalThis.fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.pollIntervalMs = options.pollIntervalMs ?? 1_500;
    this.timeoutMs = options.timeoutMs ?? 120_000;
  }

  supports(_category: GarmentCategory): boolean {
    return true;
  }

  async render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput> {
    const modelImage = request.person.imageUrl;
    if (!modelImage) {
      throw new Error('FashnProvider needs person.imageUrl (it has no Soul avatar concept)');
    }
    const startedAt = Date.now();
    const signal = options?.signal;

    const run = await this.request('POST', '/run', signal, {
      model_name: 'tryon-v1.6',
      inputs: {
        model_image: modelImage,
        garment_image: request.garment.imageUrl,
        category: FASHN_CATEGORY[request.garment.category],
      },
    });
    const { id } = runResponse.parse(run);

    for (;;) {
      if (Date.now() - startedAt > this.timeoutMs) {
        throw new Error(`FASHN render ${id} timed out after ${this.timeoutMs}ms`);
      }
      await sleep(this.pollIntervalMs, signal);

      const payload = statusResponse.parse(
        await this.request('GET', `/status/${id}`, signal),
      );
      if (payload.status === 'completed') {
        const imageUrl = payload.output?.[0];
        if (!imageUrl) throw new Error(`FASHN render ${id} completed with no output`);
        return { imageUrl, durationMs: Date.now() - startedAt };
      }
      if (payload.status === 'failed' || payload.status === 'canceled') {
        throw new Error(`FASHN render ${id} ${payload.status}: ${JSON.stringify(payload.error ?? null)}`);
      }
    }
  }

  private async request(
    method: string,
    path: string,
    signal: AbortSignal | undefined,
    body?: unknown,
  ): Promise<unknown> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`FASHN ${method} ${path} failed: ${res.status} ${text}`.trim());
    }
    return res.json();
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();
  if (ms <= 0) return;
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
