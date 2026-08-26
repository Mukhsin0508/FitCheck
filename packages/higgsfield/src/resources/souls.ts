/**
 * Soul IDs: garment-agnostic avatars built from a user's selfies.
 * FitCheck creates one per user at onboarding and reuses it for every render.
 */

import { ENDPOINTS, path } from '../endpoints';
import { estimateCostUsd } from '../costs';
import { PollTimeoutError } from '../errors';
import type { HttpClient } from '../http';
import { parseSoul, parseSoulList, type Soul } from '../schemas';
import { toImageInput } from '../types';
import type { ImageInputLike, PollOptions, UsageEvent } from '../types';

export interface CreateSoulParams {
  /** Display name, e.g. the user's first name. */
  name: string;
  /** 4–6 face selfies. More angles → better identity lock. */
  selfies: ImageInputLike[];
  /** One full-body shot for proportions. */
  fullBody?: ImageInputLike;
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export class SoulsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly onUsage?: (event: UsageEvent) => void,
  ) {}

  async create(params: CreateSoulParams): Promise<Soul> {
    const body: Record<string, unknown> = {
      name: params.name,
      reference_images: params.selfies.map(toImageInput),
      full_body_image: params.fullBody ? toImageInput(params.fullBody) : undefined,
      ...params.extra,
    };

    const payload = await this.http.request({
      method: 'POST',
      path: ENDPOINTS.soulCreate,
      body,
      signal: params.signal,
      idempotencyKey: params.idempotencyKey,
    });
    const soul = parseSoul(payload);

    this.onUsage?.({
      operation: 'soul_create',
      jobSetId: soul.id,
      model: 'soul',
      imageCount: params.selfies.length,
      estimatedCostUsd: estimateCostUsd('soul', 1),
      at: new Date(),
    });

    return soul;
  }

  async get(soulId: string, options?: { signal?: AbortSignal }): Promise<Soul> {
    const payload = await this.http.request({
      method: 'GET',
      path: path(ENDPOINTS.soulGet, { id: soulId }),
      signal: options?.signal,
    });
    return parseSoul(payload);
  }

  async list(options?: { signal?: AbortSignal }): Promise<Soul[]> {
    const payload = await this.http.request({
      method: 'GET',
      path: ENDPOINTS.soulList,
      signal: options?.signal,
    });
    return parseSoulList(payload);
  }

  /** Poll until the avatar finishes training (statuses vary; terminal = completed). */
  async waitUntilReady(soulId: string, options: PollOptions = {}): Promise<Soul> {
    const timeoutMs = options.timeoutMs ?? 300_000; // avatar training runs longer than renders
    const delayMs = options.delayMs ?? 3_000;
    const startedAt = Date.now();

    for (;;) {
      const soul = await this.get(soulId, { signal: options.signal });
      if (soul.status === 'completed') return soul;
      if (soul.status === 'failed' || soul.status === 'canceled') {
        return soul; // caller inspects status; failure here isn't an HTTP error
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed + delayMs > timeoutMs) {
        throw new PollTimeoutError(soulId, elapsed);
      }
      await new Promise<void>((resolve, reject) => {
        if (options.signal?.aborted) {
          reject(new Error('aborted'));
          return;
        }
        const timer = setTimeout(resolve, delayMs);
        options.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer);
            reject(new Error('aborted'));
          },
          { once: true },
        );
      });
    }
  }

  /** Privacy path: deleting a Soul removes its reference images server-side. */
  async delete(soulId: string, options?: { signal?: AbortSignal }): Promise<void> {
    await this.http.request({
      method: 'DELETE',
      path: path(ENDPOINTS.soulDelete, { id: soulId }),
      signal: options?.signal,
    });
  }
}
