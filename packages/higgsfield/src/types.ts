/** Shared types for the Higgsfield client. */

/**
 * Normalized request lifecycle. Wire aliases (in_queue → queued,
 * processing → in_progress, cancelled → canceled) are folded in by
 * `normalizeStatus`; unknown API statuses map to 'unknown' (still running).
 */
export type JobStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'nsfw'
  | 'canceled'
  | 'unknown';

export const TERMINAL_STATUSES: ReadonlySet<JobStatus> = new Set([
  'completed',
  'failed',
  'nsfw',
  'canceled',
]);

export interface MediaRef {
  /**
   * Pre-signed CDN link. ⚠️ EXPIRES (~7 days) — download or persist the bytes
   * promptly; never store this URL as the long-term copy of a render.
   */
  url: string;
  /** Content type when the API reports one (wire: `content_type`), e.g. 'image/jpeg'. */
  type?: string;
}

/**
 * The unit of work every submission returns — the flat wire shape of
 * POST /{endpoint} and GET /requests/{id}/status. Field names mirror the wire
 * (snake_case); `status` is normalized and `images[].type` maps `content_type`.
 */
export interface GenerationRequest {
  request_id: string;
  status: JobStatus;
  status_url?: string;
  cancel_url?: string;
  error?: string | null;
  images?: MediaRef[];
  video?: MediaRef;
  audio?: MediaRef;
  audios?: MediaRef[];
}

/** One finished image, normalized for callers. */
export interface RenderedImage {
  /** Synthetic per-image id: `${request_id}:${index}` (the wire has no per-image ids). */
  jobId: string;
  /** Pre-signed CDN link — expires in ~7 days, download promptly. */
  url: string;
  previewUrl?: string;
}

/** What `waitForResult` / `renderAndWait` resolve to. */
export interface RenderResult {
  /** The generation's request_id (kept as `jobSetId` for compatibility). */
  jobSetId: string;
  images: RenderedImage[];
  /** Wall-clock time from submit (or first poll) to terminal, in ms. */
  durationMs: number;
}

/** Server-side price quote from POST /estimate/{endpoint}. */
export interface CostEstimate {
  credits: number;
  usd: number;
}

/** Image input for generation calls: a URL the API can fetch, or an uploaded asset id. */
export type ImageInput =
  | { kind: 'url'; url: string }
  | { kind: 'asset'; id: string };

/** Accepts plain strings as URLs for ergonomics. */
export type ImageInputLike = ImageInput | string;

export function toImageInput(input: ImageInputLike): ImageInput {
  return typeof input === 'string' ? { kind: 'url', url: input } : input;
}

/** Garment categories the try-on endpoint distinguishes. */
export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outerwear' | 'full_body' | 'auto';

/** Fired after every request-creating call, so callers can log spend per render. */
export interface UsageEvent {
  /** Which client call produced the spend. */
  operation: 'tryon' | 'soul_generate' | 'soul_create';
  /** The generation's request_id (field name kept for compatibility). */
  jobSetId: string;
  /** The endpoint slug the request was submitted to. */
  model: string;
  imageCount: number;
  /** Client-side estimate; reconcile against invoices, not billing-grade. */
  estimatedCostUsd: number;
  at: Date;
}

export interface PollOptions {
  /** Overall deadline for the request, in ms. Default 300_000 (docs: ~5 min for images). */
  timeoutMs?: number;
  /** First wait before polling, in ms. Default 2_000 (documented cadence). */
  initialDelayMs?: number;
  /** Delay between polls, in ms. Grows by `backoffFactor` up to `maxDelayMs`. Default 2_000. */
  delayMs?: number;
  /** Cap for the growing delay. Default 10_000 (documented cadence). */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each poll. Default 1.5 (documented cadence). */
  backoffFactor?: number;
  /**
   * Random 0..jitterMs added to each wait (documented: 0–500ms). Default 500,
   * but never more than the current delay, so tiny test delays stay tiny.
   */
  jitterMs?: number;
  signal?: AbortSignal;
  /** Called after every poll with the latest snapshot. */
  onProgress?: (request: GenerationRequest) => void;
}

export interface RequestLogEvent {
  method: string;
  path: string;
  status?: number;
  attempt: number;
  durationMs: number;
  requestId: string;
  error?: string;
}

export interface HiggsfieldClientOptions {
  /** `KEY_ID:KEY_SECRET`, sent as `authorization: Key <credentials>`. */
  credentials?: string;
  /** Legacy pair — joined as `${apiKey}:${apiSecret}` when `credentials` is absent. */
  apiKey?: string;
  /** Legacy pair — see {@link HiggsfieldClientOptions.apiKey}. */
  apiSecret?: string;
  /** Override for testing/staging. Default {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
  /**
   * Override the try-on endpoint slug (the default in `models.ts` is a best
   * guess — the try-on model is not in the public docs yet).
   */
  tryOnEndpoint?: string;
  /**
   * The Soul ID API is not in the public platform docs yet; souls.* throws
   * until this is set to the real base path (e.g. '/souls') or your proxy's.
   */
  soulsBasePath?: string;
  /** Per-attempt HTTP timeout in ms. Default 30_000. */
  timeoutMs?: number;
  /** Retries after the first attempt for retryable failures. Default 3. */
  maxRetries?: number;
  /** Custom fetch (tests, proxies). Defaults to global fetch. */
  fetch?: typeof globalThis.fetch;
  /** Spend accounting hook — FitCheck logs cost per render through this. */
  onUsage?: (event: UsageEvent) => void;
  /** Structured request log hook. Secrets are never included. */
  onRequest?: (event: RequestLogEvent) => void;
}
