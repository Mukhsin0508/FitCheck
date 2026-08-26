import { DEFAULT_BASE_URL } from './endpoints';
import { HttpClient } from './http';
import { MockTransport, type MockTransportOptions } from './mock';
import { FetchTransport, type Transport } from './transport';
import { ImagesResource } from './resources/images';
import { JobsResource } from './resources/jobs';
import { SoulsResource } from './resources/souls';
import { TryOnResource } from './resources/tryon';
import type { HiggsfieldClientOptions } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/**
 * Typed client for the Higgsfield API.
 *
 * ```ts
 * const hf = new HiggsfieldClient({ apiKey, apiSecret });
 *
 * // Onboarding: selfies → garment-agnostic avatar
 * const soul = await hf.souls.create({ name: 'Amara', selfies, fullBody });
 * await hf.souls.waitUntilReady(soul.id);
 *
 * // The core loop: garment → photo of the user wearing it
 * const render = await hf.tryon.renderAndWait({
 *   soulId: soul.id,
 *   garmentImage: product.imageUrl,
 *   category: 'dress',
 * });
 * render.images[0].url; // show it, share it, sell it
 * ```
 *
 * Keep this server-side. The key/secret pair must never ship inside the app —
 * the mobile client talks to FitCheck's own API, which holds the credentials.
 */
export class HiggsfieldClient {
  readonly souls: SoulsResource;
  readonly tryon: TryOnResource;
  readonly images: ImagesResource;
  readonly jobs: JobsResource;

  private constructor(transport: Transport, options: HiggsfieldClientOptions) {
    const http = new HttpClient(transport, {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      apiKey: options.apiKey,
      apiSecret: options.apiSecret,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      onRequest: options.onRequest,
    });

    this.jobs = new JobsResource(http);
    this.souls = new SoulsResource(http, options.onUsage);
    this.tryon = new TryOnResource(http, this.jobs, options.onUsage);
    this.images = new ImagesResource(http, this.jobs, options.onUsage);
  }

  static create(options: HiggsfieldClientOptions): HiggsfieldClient {
    if (!options.apiKey || !options.apiSecret) {
      throw new TypeError('HiggsfieldClient requires apiKey and apiSecret');
    }
    return new HiggsfieldClient(new FetchTransport(options.fetch), options);
  }

  /** Inject any Transport — used by tests and custom integrations. */
  static withTransport(
    transport: Transport,
    options: Partial<HiggsfieldClientOptions> = {},
  ): HiggsfieldClient {
    return new HiggsfieldClient(transport, {
      apiKey: options.apiKey ?? 'mock-key',
      apiSecret: options.apiSecret ?? 'mock-secret',
      ...options,
    });
  }

  /** Fully offline client backed by {@link MockTransport} — demo mode and tests. */
  static mock(
    mockOptions: MockTransportOptions = {},
    options: Partial<HiggsfieldClientOptions> = {},
  ): HiggsfieldClient {
    return HiggsfieldClient.withTransport(new MockTransport(mockOptions), options);
  }
}
