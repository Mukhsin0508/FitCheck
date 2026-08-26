/**
 * General Soul image generation (text-to-image, optionally personalized with a
 * Soul ID). FitCheck uses this for marketing/share assets, not for try-on —
 * try-on has its own resource.
 *
 * Submits to the documented, verified slug 'higgsfield-ai/soul/standard'
 * (see models.ts) with { prompt, aspect_ratio, num_images, ... } as the body.
 */

import { submitPath } from '../endpoints';
import { MODELS } from '../models';
import { estimateCostUsd } from '../costs';
import type { HttpClient } from '../http';
import { parseGenerationRequest } from '../schemas';
import type { GenerationRequest, PollOptions, RenderResult, UsageEvent } from '../types';
import type { JobsResource } from './jobs';

export interface GenerateImageParams {
  prompt: string;
  /** Personalize with an avatar. */
  soulId?: string;
  /** e.g. '3:4', '1:1', '16:9'. Default '3:4'. */
  aspectRatio?: string;
  imageCount?: number;
  webhookUrl?: string;
  /** Submit to a different slug, e.g. MODELS.soulV2.endpoint. */
  endpoint?: string;
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export class ImagesResource {
  constructor(
    private readonly http: HttpClient,
    private readonly jobs: JobsResource,
    private readonly onUsage?: (event: UsageEvent) => void,
  ) {}

  async generate(params: GenerateImageParams): Promise<GenerationRequest> {
    const endpoint = params.endpoint ?? MODELS.soulImage.endpoint;
    const imageCount = params.imageCount ?? 1;
    const body: Record<string, unknown> = {
      ...MODELS.soulImage.defaults,
      prompt: params.prompt,
      soul_id: params.soulId,
      aspect_ratio: params.aspectRatio ?? MODELS.soulImage.defaults.aspect_ratio,
      num_images: imageCount,
      webhook_url: params.webhookUrl,
      ...params.extra,
    };

    const payload = await this.http.request({
      method: 'POST',
      path: submitPath(endpoint),
      body,
      signal: params.signal,
      idempotencyKey: params.idempotencyKey,
    });
    const request = parseGenerationRequest(payload);

    this.onUsage?.({
      operation: 'soul_generate',
      jobSetId: request.request_id,
      model: endpoint,
      imageCount,
      estimatedCostUsd: estimateCostUsd(endpoint, imageCount),
      at: new Date(),
    });

    return request;
  }

  async generateAndWait(params: GenerateImageParams, poll: PollOptions = {}): Promise<RenderResult> {
    const request = await this.generate(params);
    return this.jobs.waitForResult(request.request_id, { signal: params.signal, ...poll });
  }
}
