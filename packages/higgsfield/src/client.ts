import { DEFAULT_BASE_URL } from './endpoints';
import { HttpClient } from './http';
import { MockTransport, type MockTransportOptions } from './mock';
import { FetchTransport, type Transport } from './transport';
import { ImagesResource } from './resources/images';
import { JobsResource } from './resources/jobs';
import { SoulsResource } from './resources/souls';
import { TryOnResource } from './resources/tryon';
import { UploadsResource } from './resources/uploads';
import type { CostEstimate, HiggsfieldClientOptions } from './types';

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;

/** `credentials` ('KEY_ID:KEY_SECRET') wins; the legacy apiKey/apiSecret pair is joined. */
function resolveCredentials(options: HiggsfieldClientOptions): string | undefined {
  if (options.credentials) return options.credentials;
  if (options.apiKey && options.apiSecret) return `${options.apiKey}:${options.apiSecret}`;
  return undefined;
}

/**
 * Typed client for the Higgsfield platform API (platform.higgsfield.ai,
 * the @higgsfield/client v2 wire protocol).
 *
 * ```ts
 * const hf = HiggsfieldClient.create({ credentials: 'KEY_ID:KEY_SECRET' });
 *
 * // The core loop: garment → photo of the user wearing it
 * const render = await hf.tryon.renderAndWait({
 *   soulId: user.soulId,
 *   garmentImage: product.imageUrl,
 *   category: 'dress',
 * });
 * render.images[0].url; // ⚠️ pre-signed CDN link, expires (~7 days) — persist it promptly
 * ```
 *
 * Keep this server-side. The KEY_ID:KEY_SECRET pair must never ship inside
 * the app — the mobile client talks to FitCheck's own API, which holds the
 * credentials.
 */
export class HiggsfieldClient {
  readonly souls: SoulsResource;
  readonly tryon: TryOnResource;
  readonly images: ImagesResource;
  readonly jobs: JobsResource;
  readonly uploads: UploadsResource;

  private constructor(transport: Transport, options: HiggsfieldClientOptions) {
    const credentials = resolveCredentials(options);
    if (!credentials) {
      throw new TypeError(
        'HiggsfieldClient requires credentials ("KEY_ID:KEY_SECRET") or the apiKey/apiSecret pair',
      );
    }

    const http = new HttpClient(transport, {
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      credentials,
      timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      maxRetries: options.maxRetries ?? DEFAULT_MAX_RETRIES,
      onRequest: options.onRequest,
    });

    this.jobs = new JobsResource(http);
    this.souls = new SoulsResource(http, options.onUsage, options.soulsBasePath);
    this.tryon = new TryOnResource(http, this.jobs, options.onUsage, options.tryOnEndpoint);
    this.images = new ImagesResource(http, this.jobs, options.onUsage);
    this.uploads = new UploadsResource(http, options.fetch ?? globalThis.fetch?.bind(globalThis));
  }

  /** Billing-grade quote from POST /estimate/{endpoint}. Shortcut for `jobs.estimateRemote`. */
  estimateRemote(
    endpoint: string,
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<CostEstimate> {
    return this.jobs.estimateRemote(endpoint, input, options);
  }

  static create(options: HiggsfieldClientOptions): HiggsfieldClient {
    if (!resolveCredentials(options)) {
      throw new TypeError(
        'HiggsfieldClient requires credentials ("KEY_ID:KEY_SECRET") or the apiKey/apiSecret pair',
      );
    }
    return new HiggsfieldClient(new FetchTransport(options.fetch), options);
  }

  /** Inject any Transport — used by tests and custom integrations. */
  static withTransport(
    transport: Transport,
    options: Partial<HiggsfieldClientOptions> = {},
  ): HiggsfieldClient {
    const withDefaults: HiggsfieldClientOptions = { ...options };
    if (!resolveCredentials(withDefaults)) {
      withDefaults.credentials = 'mock-key:mock-secret';
    }
    return new HiggsfieldClient(transport, withDefaults);
  }

  /** Fully offline client backed by {@link MockTransport} — demo mode and tests. */
  static mock(
    mockOptions: MockTransportOptions = {},
    options: Partial<HiggsfieldClientOptions> = {},
  ): HiggsfieldClient {
    return HiggsfieldClient.withTransport(new MockTransport(mockOptions), options);
  }
}
