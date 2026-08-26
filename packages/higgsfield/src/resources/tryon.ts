/**
 * Try-on renders: FitCheck's core call. Person (Soul avatar or photo) +
 * garment image → photoreal image of that person wearing the garment.
 */

import { ENDPOINTS } from '../endpoints';
import { estimateCostUsd } from '../costs';
import type { HttpClient } from '../http';
import { parseJobSet } from '../schemas';
import { toImageInput } from '../types';
import type {
  GarmentCategory,
  ImageInputLike,
  JobSet,
  PollOptions,
  RenderResult,
  UsageEvent,
} from '../types';
import type { JobsResource } from './jobs';

export interface CreateTryOnParams {
  /** Soul avatar id created during onboarding. Preferred: garment-agnostic identity. */
  soulId?: string;
  /** Or a direct person photo, when no avatar exists yet. */
  personImage?: ImageInputLike;
  /** The garment to put on them — product image URL or uploaded asset. */
  garmentImage: ImageInputLike;
  /** Helps the model with fit and occlusion. Default 'auto'. */
  category?: GarmentCategory;
  /** Images to render (some plans support >1 for variations). Default 1. */
  imageCount?: number;
  /** Optional webhook Higgsfield calls when the job set is terminal. */
  webhookUrl?: string;
  /** Free-form passthrough for params the OpenAPI schema adds later. */
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

const TRYON_MODEL = 'soul-outfit';

export class TryOnResource {
  constructor(
    private readonly http: HttpClient,
    private readonly jobs: JobsResource,
    private readonly onUsage?: (event: UsageEvent) => void,
  ) {}

  /** Submit a try-on render. Returns the job set to poll (or use {@link renderAndWait}). */
  async create(params: CreateTryOnParams): Promise<JobSet> {
    if (!params.soulId && !params.personImage) {
      throw new TypeError('createTryOn needs either soulId or personImage');
    }

    const garment = toImageInput(params.garmentImage);
    const person = params.personImage ? toImageInput(params.personImage) : undefined;
    const imageCount = params.imageCount ?? 1;

    const body: Record<string, unknown> = {
      params: {
        model: TRYON_MODEL,
        soul_id: params.soulId,
        person_image: person,
        garment_image: garment,
        category: params.category ?? 'auto',
        image_count: imageCount,
        webhook_url: params.webhookUrl,
        ...params.extra,
      },
    };

    const payload = await this.http.request({
      method: 'POST',
      path: ENDPOINTS.tryOn,
      body,
      signal: params.signal,
      idempotencyKey: params.idempotencyKey,
    });
    const jobSet = parseJobSet(payload);

    this.onUsage?.({
      operation: 'tryon',
      jobSetId: jobSet.id,
      model: TRYON_MODEL,
      imageCount,
      estimatedCostUsd: estimateCostUsd(TRYON_MODEL, imageCount),
      at: new Date(),
    });

    return jobSet;
  }

  /** Submit and poll to completion in one call — what the app uses. */
  async renderAndWait(
    params: CreateTryOnParams,
    poll: PollOptions = {},
  ): Promise<RenderResult> {
    const jobSet = await this.create(params);
    return this.jobs.waitForResult(jobSet.id, { signal: params.signal, ...poll });
  }
}
