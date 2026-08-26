/**
 * Poll a generation request until terminal, with the documented cadence:
 * 2s initial delay × 1.5 backoff, capped at 10s, plus 0–500ms jitter.
 */

import { AbortError, JobFailedError, PollTimeoutError } from './errors';
import { TERMINAL_STATUSES } from './types';
import type { GenerationRequest, PollOptions, RenderResult, RenderedImage } from './types';

const DEFAULTS = {
  timeoutMs: 300_000,
  initialDelayMs: 2_000,
  delayMs: 2_000,
  maxDelayMs: 10_000,
  backoffFactor: 1.5,
  jitterMs: 500,
} as const;

/** Abort-aware delay: resolves after `ms`, rejects with {@link AbortError} when the signal fires. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function isRequestTerminal(request: GenerationRequest): boolean {
  return TERMINAL_STATUSES.has(request.status);
}

/**
 * Extract completed images; throws {@link JobFailedError} when the request
 * finished without one (failed / nsfw / canceled / completed-but-empty).
 *
 * ⚠️ The returned URLs are pre-signed CDN links that EXPIRE (~7 days) —
 * download or persist them promptly.
 */
export function toRenderResult(request: GenerationRequest, durationMs: number): RenderResult {
  const images: RenderedImage[] =
    request.status === 'completed'
      ? (request.images ?? [])
          .filter((image) => image.url)
          .map((image, index) => ({
            jobId: `${request.request_id}:${index}`,
            url: image.url,
          }))
      : [];

  if (images.length === 0) {
    throw new JobFailedError(request.request_id, [request.status], {
      requestId: request.request_id,
      body: request.error ?? undefined,
    });
  }
  return { jobSetId: request.request_id, images, durationMs };
}

/** Poll GET /requests/{id}/status (via `fetchStatus`) until the request is terminal. */
export async function pollRequest(
  fetchStatus: () => Promise<GenerationRequest>,
  requestId: string,
  options: PollOptions = {},
): Promise<GenerationRequest> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const backoffFactor = options.backoffFactor ?? DEFAULTS.backoffFactor;
  const jitterMs = options.jitterMs ?? DEFAULTS.jitterMs;
  let delayMs = options.delayMs ?? DEFAULTS.delayMs;

  // Documented jitter is 0–500ms, but never longer than the current delay —
  // so tests running with 1ms delays are not slowed to ~500ms per poll.
  const jitter = () => Math.random() * Math.min(jitterMs, delayMs);

  const startedAt = Date.now();
  await sleep(options.initialDelayMs ?? DEFAULTS.initialDelayMs, options.signal);

  // Always poll at least once, even with a tiny timeout.
  for (;;) {
    const request = await fetchStatus();
    options.onProgress?.(request);
    if (isRequestTerminal(request)) {
      return request;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed + delayMs > timeoutMs) {
      throw new PollTimeoutError(requestId, elapsed);
    }
    await sleep(delayMs + jitter(), options.signal);
    delayMs = Math.min(Math.round(delayMs * backoffFactor), maxDelayMs);
  }
}
