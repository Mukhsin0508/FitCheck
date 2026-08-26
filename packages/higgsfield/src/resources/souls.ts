/**
 * Soul IDs: garment-agnostic avatars built from a user's selfies.
 *
 * ⚠️ NOT IMPLEMENTED ON THE PLATFORM (yet). The public platform API
 * (platform.higgsfield.ai) documents no Soul ID management endpoints — the
 * earlier '/v1/souls' paths this resource used were guessed and are wrong.
 * Every method throws a clear ApiError UNLESS the client is constructed with
 * `soulsBasePath` (HiggsfieldClientOptions), pointing at the real path once
 * Higgsfield publishes it — or at your own proxy that implements it.
 *
 * The resource itself stays: FitCheck's app types reference it, and demo mode
 * never calls it.
 */

import { estimateCostUsd } from '../costs';
import { ApiError, PollTimeoutError } from '../errors';
import type { HttpClient } from '../http';
import { sleep } from '../polling';
import { parseSoul, parseSoulList, type Soul } from '../schemas';
import { TERMINAL_STATUSES, toImageInput } from '../types';
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
    private readonly basePath?: string,
  ) {}

  /** Throws unless a custom soulsBasePath was configured. Returns the normalized base. */
  private requireBasePath(): string {
    if (!this.basePath) {
      throw new ApiError(
        'The Soul ID API is not in the public platform docs yet (platform.higgsfield.ai ' +
          'exposes no souls endpoints). Configure HiggsfieldClientOptions.soulsBasePath ' +
          'once Higgsfield publishes it, or point it at a proxy that implements it.',
      );
    }
    return `/${this.basePath.replace(/^\/+|\/+$/g, '')}`;
  }

  private soulPath(soulId: string): string {
    return `${this.requireBasePath()}/${encodeURIComponent(soulId)}`;
  }

  async create(params: CreateSoulParams): Promise<Soul> {
    const basePath = this.requireBasePath();
    const body: Record<string, unknown> = {
      name: params.name,
      reference_images: params.selfies.map(toImageInput),
      full_body_image: params.fullBody ? toImageInput(params.fullBody) : undefined,
      ...params.extra,
    };

    const payload = await this.http.request({
      method: 'POST',
      path: basePath,
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
      path: this.soulPath(soulId),
      signal: options?.signal,
    });
    return parseSoul(payload);
  }

  async list(options?: { signal?: AbortSignal }): Promise<Soul[]> {
    const payload = await this.http.request({
      method: 'GET',
      path: this.requireBasePath(),
      signal: options?.signal,
    });
    return parseSoulList(payload);
  }

  /** Poll until the avatar reaches a terminal status (completed/failed/nsfw/canceled). */
  async waitUntilReady(soulId: string, options: PollOptions = {}): Promise<Soul> {
    this.requireBasePath();
    const timeoutMs = options.timeoutMs ?? 300_000; // avatar training runs longer than renders
    const delayMs = options.delayMs ?? 3_000;
    const startedAt = Date.now();

    for (;;) {
      const soul = await this.get(soulId, { signal: options.signal });
      if (TERMINAL_STATUSES.has(soul.status)) {
        return soul; // caller inspects status; failed/nsfw/canceled here isn't an HTTP error
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed + delayMs > timeoutMs) {
        throw new PollTimeoutError(soulId, elapsed);
      }
      await sleep(delayMs, options.signal);
    }
  }

  /** Privacy path: deleting a Soul removes its reference images server-side. */
  async delete(soulId: string, options?: { signal?: AbortSignal }): Promise<void> {
    await this.http.request({
      method: 'DELETE',
      path: this.soulPath(soulId),
      signal: options?.signal,
    });
  }
}
