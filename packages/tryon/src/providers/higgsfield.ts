import type { HiggsfieldClient, PollOptions } from '@fitcheck/higgsfield';
import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '../types';

export interface HiggsfieldTryOnProviderOptions {
  /** Poll tuning passed to renderAndWait (tests use tiny delays). */
  poll?: PollOptions;
}

/**
 * Primary provider: Higgsfield try-on (platform API, @higgsfield/client v2
 * wire protocol). `renderAndWait` submits POST /{endpointSlug} and polls
 * GET /requests/{id}/status; the returned image URLs are pre-signed CDN links
 * that expire (~7 days) — persist them promptly if kept beyond the session.
 */
export class HiggsfieldTryOnProvider implements TryOnProvider {
  readonly name = 'higgsfield' as const;
  readonly costPerRenderUsd = 0.09;

  constructor(
    private readonly client: HiggsfieldClient,
    private readonly options: HiggsfieldTryOnProviderOptions = {},
  ) {}

  supports(_category: GarmentCategory): boolean {
    return true;
  }

  async render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput> {
    const { soulId, imageUrl } = request.person;
    if (!soulId && !imageUrl) {
      throw new TypeError('HiggsfieldTryOnProvider needs person.soulId or person.imageUrl');
    }

    const result = await this.client.tryon.renderAndWait(
      {
        // soulId is preferred; personImage is only sent when there is no Soul
        soulId,
        personImage: soulId ? undefined : imageUrl,
        garmentImage: request.garment.imageUrl,
        category: request.garment.category,
        signal: options?.signal,
      },
      this.options.poll ?? {},
    );

    const image = result.images[0];
    if (!image) {
      throw new Error('Higgsfield render completed with no images');
    }
    return {
      imageUrl: image.url,
      previewUrl: image.previewUrl,
      durationMs: result.durationMs,
    };
  }
}
