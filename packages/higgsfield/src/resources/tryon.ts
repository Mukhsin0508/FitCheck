/**
 * Try-on renders: FitCheck's core call. Person (Soul avatar or photo) +
 * garment image → photoreal image of that person wearing the garment.
 *
 * ⚠️ The try-on endpoint slug is UNVERIFIED (not in the public platform docs
 * yet — see models.ts), and the input contract below is a best guess pending
 * the slug's real schema: { soul_id?, person_image?, garment_image, category,
 * ...extra }. Override the slug via HiggsfieldClientOptions.tryOnEndpoint.
 */

import { submitPath } from '../endpoints';
import { MODELS } from '../models';
import { estimateCostUsd } from '../costs';
import type { HttpClient } from '../http';
import { parseGenerationRequest } from '../schemas';
import { toImageInput } from '../types';
import type {
  GarmentCategory,
  GenerationRequest,
  ImageInputLike,
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
  /** Optional webhook Higgsfield calls when the request is terminal. */
  webhookUrl?: string;
  /** Free-form passthrough for params the real schema adds later. */
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Wire form of an image input: a fetchable URL, or an uploaded asset's id. */
function toWireImage(input: ImageInputLike): string {
  const image = toImageInput(input);
  return image.kind === 'url' ? image.url : image.id;
}

export class TryOnResource {
  private readonly endpoint: string;

  constructor(
    private readonly http: HttpClient,
    private readonly jobs: JobsResource,
    private readonly onUsage?: (event: UsageEvent) => void,
    endpoint?: string,
  ) {
    this.endpoint = endpoint ?? MODELS.tryOn.endpoint;
  }

  /** Submit a try-on render. Returns the request to poll (or use {@link renderAndWait}). */
  async create(params: CreateTryOnParams): Promise<GenerationRequest> {
    if (!params.soulId && !params.personImage) {
      throw new TypeError('createTryOn needs either soulId or personImage');
    }

    const imageCount = params.imageCount ?? 1;

    // POST /{endpointSlug} with the input object as the JSON body — no
    // { params: ... } envelope. Field names are our best guess (see header).
    const body: Record<string, unknown> = {
      ...MODELS.tryOn.defaults,
      soul_id: params.soulId,
      person_image: params.personImage ? toWireImage(params.personImage) : undefined,
      garment_image: toWireImage(params.garmentImage),
      category: params.category ?? 'auto',
      num_images: imageCount,
      webhook_url: params.webhookUrl,
      ...params.extra,
    };

    const payload = await this.http.request({
      method: 'POST',
      path: submitPath(this.endpoint),
      body,
      signal: params.signal,
      idempotencyKey: params.idempotencyKey,
    });
    const request = parseGenerationRequest(payload);

    this.onUsage?.({
      operation: 'tryon',
      jobSetId: request.request_id,
      model: this.endpoint,
      imageCount,
      estimatedCostUsd: estimateCostUsd(this.endpoint, imageCount),
      at: new Date(),
    });

    return request;
  }

  /** Submit and poll to completion in one call — what the app uses. */
  async renderAndWait(
    params: CreateTryOnParams,
    poll: PollOptions = {},
  ): Promise<RenderResult> {
    const request = await this.create(params);
    return this.jobs.waitForResult(request.request_id, { signal: params.signal, ...poll });
  }
}
