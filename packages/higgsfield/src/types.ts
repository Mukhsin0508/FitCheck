/** Shared types for the Higgsfield client. */

/** Normalized job lifecycle. Unknown API statuses map to 'unknown' (treated as still running). */
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
  url: string;
  /** Content type when the API reports one, e.g. 'image/jpeg'. */
  type?: string;
}

export interface Job {
  id: string;
  status: JobStatus;
  /** Full-resolution and preview outputs, when the job has produced them. */
  results?: {
    raw?: MediaRef;
    min?: MediaRef;
  };
  error?: string;
}

/** The unit of work every generation call returns; poll it until terminal. */
export interface JobSet {
  id: string;
  jobs: Job[];
}

/** One finished image, normalized for callers. */
export interface RenderedImage {
  jobId: string;
  url: string;
  previewUrl?: string;
}

/** What `waitForJobSet` / `renderAndWait` resolve to. */
export interface RenderResult {
  jobSetId: string;
  images: RenderedImage[];
  /** Wall-clock time from submit (or first poll) to terminal, in ms. */
  durationMs: number;
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

/** Fired after every job-creating call, so callers can log spend per render. */
export interface UsageEvent {
  /** Which client call produced the spend. */
  operation: 'tryon' | 'soul_generate' | 'soul_create';
  jobSetId: string;
  model: string;
  imageCount: number;
  /** Client-side estimate; reconcile against invoices, not billing-grade. */
  estimatedCostUsd: number;
  at: Date;
}

export interface PollOptions {
  /** Overall deadline for the job set, in ms. Default 120_000. */
  timeoutMs?: number;
  /** First wait before polling, in ms. Default 1_000. */
  initialDelayMs?: number;
  /** Delay between polls, in ms. Grows by `backoffFactor` up to `maxDelayMs`. Default 1_500. */
  delayMs?: number;
  /** Cap for the growing delay. Default 5_000. */
  maxDelayMs?: number;
  /** Multiplier applied to the delay after each poll. Default 1.5. */
  backoffFactor?: number;
  signal?: AbortSignal;
  /** Called after every poll with the latest snapshot. */
  onProgress?: (jobSet: JobSet) => void;
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
  /** `hf-api-key` header value. */
  apiKey: string;
  /** `hf-secret` header value. */
  apiSecret: string;
  /** Override for testing/staging. Default {@link DEFAULT_BASE_URL}. */
  baseUrl?: string;
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
