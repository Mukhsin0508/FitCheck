/**
 * Try-on renders: FitCheck's core call. Person photo + garment image →
 * photoreal image of that person wearing the garment.
 *
 * Runs on Popcorn (higgsfield-ai/popcorn/auto), Higgsfield's multi-image
 * editing model — contract verified against the published OpenAPI schema:
 * { prompt*, image_urls: [person, garment], num_images, resolution, aspect_ratio }.
 * The person must be an image URL; there is no public avatar-id API yet
 * (soulId is accepted for forward compatibility but needs a custom endpoint).
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
  /**
   * Avatar id, once Higgsfield ships a public custom-reference API. Today the
   * public try-on path needs personImage; soulId alone throws unless a custom
   * tryOnEndpoint that accepts it is configured.
   */
  soulId?: string;
  /** The person: a fetchable photo URL (upload local files via `client.uploads`). */
  personImage?: ImageInputLike;
  /** The garment to put on them — product image URL or uploaded asset. */
  garmentImage: ImageInputLike;
  /** Steers the edit prompt ('dress', 'outerwear', …). Default 'auto'. */
  category?: GarmentCategory;
  /** Override the generated edit prompt entirely. */
  prompt?: string;
  /** Images to render (Popcorn: num_images). Default 1. */
  imageCount?: number;
  /** Optional webhook Higgsfield calls when the request is terminal. */
  webhookUrl?: string;
  /** Free-form passthrough merged into the body last. */
  extra?: Record<string, unknown>;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Wire form of an image input: a fetchable URL, or an uploaded asset's id. */
function toWireImage(input: ImageInputLike): string {
  const image = toImageInput(input);
  return image.kind === 'url' ? image.url : image.id;
}

const GARMENT_NOUN: Record<GarmentCategory, string> = {
  top: 'top',
  bottom: 'bottoms',
  dress: 'dress',
  outerwear: 'outerwear piece',
  full_body: 'outfit',
  auto: 'garment',
};

/**
 * The edit instruction the model gets when the caller doesn't supply one.
 * The identity language matters: without it the models tend to age the
 * subject, add weight, and wax the skin.
 */
export function defaultTryOnPrompt(category: GarmentCategory): string {
  const noun = GARMENT_NOUN[category];
  return (
    `The exact same person from the first image, 100% face accuracy, same age ` +
    `and same body, now wearing the ${noun} from the second image. Full-body ` +
    'view, natural fit and drape, bright minimal room with soft window light, ' +
    'photoreal, no waxy skin, no plastic retouching.'
  );
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
    const usingDefaultEndpoint = this.endpoint === MODELS.tryOn.endpoint;
    if (!params.personImage && usingDefaultEndpoint) {
      throw new TypeError(
        'createTryOn needs personImage: the public try-on path (Popcorn) takes image URLs, ' +
          'and there is no public avatar-id API yet. Upload the photo via client.uploads first.',
      );
    }
    if (!params.soulId && !params.personImage) {
      throw new TypeError('createTryOn needs either soulId or personImage');
    }

    const imageCount = params.imageCount ?? 1;
    const category = params.category ?? 'auto';

    // POST /{endpointSlug}, input as the flat JSON body (no envelope).
    // Default-model defaults only apply to the default endpoint — override
    // endpoints (e.g. nano-banana-2) have different valid resolutions.
    const defaults = usingDefaultEndpoint
      ? MODELS.tryOn.defaults
      : { aspect_ratio: '3:4' as const };
    const body: Record<string, unknown> = {
      ...defaults,
      prompt: params.prompt ?? defaultTryOnPrompt(category),
      image_urls: [
        ...(params.personImage ? [toWireImage(params.personImage)] : []),
        toWireImage(params.garmentImage),
      ],
      num_images: imageCount,
      webhook_url: params.webhookUrl,
      // Non-default endpoints may want the avatar id; Popcorn ignores it.
      ...(params.soulId ? { soul_id: params.soulId } : {}),
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
