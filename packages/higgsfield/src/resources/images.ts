/**
 * General Soul image generation (text-to-image, optionally personalized with a
 * Soul ID). FitCheck uses this for marketing/share assets, not for try-on —
 * try-on has its own resource.
 */

import { ENDPOINTS } from '../endpoints';
import { estimateCostUsd } from '../costs';
import type { HttpClient } from '../http';
import { parseJobSet } from '../schemas';
import type { JobSet, PollOptions, RenderResult, UsageEvent } from '../types';
import type { JobsResource } from './jobs';

export interface GenerateImageParams {
  prompt: string;
  /** Personalize with an avatar. */
  soulId?: string;
  /** e.g. '3:4', '1:1', '16:9'. */
  aspectRatio?: string;
  imageCount?: number;
  webhookUrl?: string;
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

const SOUL_MODEL = 'soul';

export class ImagesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly jobs: JobsResource,
    private readonly onUsage?: (event: UsageEvent) => void,
  ) {}

  async generate(params: GenerateImageParams): Promise<JobSet> {
    const imageCount = params.imageCount ?? 1;
    const body: Record<string, unknown> = {
      params: {
        model: SOUL_MODEL,
        prompt: params.prompt,
        soul_id: params.soulId,
        aspect_ratio: params.aspectRatio ?? '3:4',
        image_count: imageCount,
        webhook_url: params.webhookUrl,
        ...params.extra,
      },
    };

    const payload = await this.http.request({
      method: 'POST',
      path: ENDPOINTS.soulGenerate,
      body,
      signal: params.signal,
      idempotencyKey: params.idempotencyKey,
    });
    const jobSet = parseJobSet(payload);

    this.onUsage?.({
      operation: 'soul_generate',
      jobSetId: jobSet.id,
      model: SOUL_MODEL,
      imageCount,
      estimatedCostUsd: estimateCostUsd(SOUL_MODEL, imageCount),
      at: new Date(),
    });

    return jobSet;
  }

  async generateAndWait(params: GenerateImageParams, poll: PollOptions = {}): Promise<RenderResult> {
    const jobSet = await this.generate(params);
    return this.jobs.waitForResult(jobSet.id, { signal: params.signal, ...poll });
  }
}
