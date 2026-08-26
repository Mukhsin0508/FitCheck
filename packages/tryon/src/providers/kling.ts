/**
 * PROVISIONAL — written against the publicly documented Kling AI
 * kolors-virtual-try-on shape (POST /v1/images/kolors-virtual-try-on,
 * poll GET /{task_id}). Verify against Kling docs before production use.
 *
 * Kling authenticates with a short-lived JWT signed from an accessKey/secretKey
 * pair; callers own that signing and pass `getToken` (keeps crypto deps out).
 */

import { z } from 'zod';
import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '../types';

export interface KlingProviderOptions {
  /** Returns a valid JWT for the Authorization header. Called per request. */
  getToken: () => Promise<string>;
  fetch?: typeof globalThis.fetch;
  baseUrl?: string;
  /** Delay between status polls, ms. Default 1500. */
  pollIntervalMs?: number;
  /** Overall render deadline, ms. Default 120_000. */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = 'https://api-singapore.klingai.com/v1/images/kolors-virtual-try-on';

const createResponse = z.looseObject({
  code: z.number().optional(),
  message: z.string().optional(),
  data: z.looseObject({ task_id: z.string() }),
});

const statusResponse = z.looseObject({
  code: z.number().optional(),
  data: z.looseObject({
    task_status: z.string(),
    task_status_msg: z.string().optional(),
    task_result: z
      .looseObject({
        images: z.array(z.looseObject({ url: z.string() })).optional(),
      })
      .optional(),
  }),
});

export class KlingProvider implements TryOnProvider {
  readonly name = 'kling' as const;
  readonly costPerRenderUsd = 0.07;

  private readonly fetch: typeof globalThis.fetch;
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly timeoutMs: number;

  constructor(private readonly options: KlingProviderOptions) {
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
    const humanImage = request.person.imageUrl;
    if (!humanImage) {
      throw new Error('KlingProvider needs person.imageUrl (it has no Soul avatar concept)');
    }
    const startedAt = Date.now();
    const signal = options?.signal;

    const created = createResponse.parse(
      await this.request('POST', '', signal, {
        human_image: humanImage,
        cloth_image: request.garment.imageUrl,
      }),
    );
    const taskId = created.data.task_id;

    for (;;) {
      if (Date.now() - startedAt > this.timeoutMs) {
        throw new Error(`Kling task ${taskId} timed out after ${this.timeoutMs}ms`);
      }
      await sleep(this.pollIntervalMs, signal);

      const payload = statusResponse.parse(await this.request('GET', `/${taskId}`, signal));
      const status = payload.data.task_status;
      if (status === 'succeed') {
        const imageUrl = payload.data.task_result?.images?.[0]?.url;
        if (!imageUrl) throw new Error(`Kling task ${taskId} succeeded with no images`);
        return { imageUrl, durationMs: Date.now() - startedAt };
      }
      if (status === 'failed') {
        throw new Error(`Kling task ${taskId} failed: ${payload.data.task_status_msg ?? 'unknown'}`);
      }
    }
  }

  private async request(
    method: string,
    path: string,
    signal: AbortSignal | undefined,
    body?: unknown,
  ): Promise<unknown> {
    const token = await this.options.getToken();
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Kling ${method} ${path || '/'} failed: ${res.status} ${text}`.trim());
    }
    return res.json();
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
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
