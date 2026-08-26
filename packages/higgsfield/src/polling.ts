/** Poll a job set until every job is terminal, with backoff and cancellation. */

import { AbortError, JobFailedError, PollTimeoutError } from './errors';
import { TERMINAL_STATUSES } from './types';
import type { JobSet, PollOptions, RenderResult, RenderedImage } from './types';

const DEFAULTS = {
  timeoutMs: 120_000,
  initialDelayMs: 1_000,
  delayMs: 1_500,
  maxDelayMs: 5_000,
  backoffFactor: 1.5,
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

export function isJobSetTerminal(jobSet: JobSet): boolean {
  return jobSet.jobs.length > 0 && jobSet.jobs.every((job) => TERMINAL_STATUSES.has(job.status));
}

/** Extract completed images; throws {@link JobFailedError} when nothing completed. */
export function toRenderResult(jobSet: JobSet, durationMs: number): RenderResult {
  const images: RenderedImage[] = jobSet.jobs
    .filter((job) => job.status === 'completed' && job.results?.raw?.url)
    .map((job) => ({
      jobId: job.id,
      // The filter above guarantees results.raw.url exists.
      url: job.results!.raw!.url,
      previewUrl: job.results?.min?.url,
    }));

  if (images.length === 0) {
    throw new JobFailedError(
      jobSet.id,
      jobSet.jobs.map((job) => job.status),
    );
  }
  return { jobSetId: jobSet.id, images, durationMs };
}

export async function pollJobSet(
  fetchJobSet: () => Promise<JobSet>,
  jobSetId: string,
  options: PollOptions = {},
): Promise<JobSet> {
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
  const maxDelayMs = options.maxDelayMs ?? DEFAULTS.maxDelayMs;
  const backoffFactor = options.backoffFactor ?? DEFAULTS.backoffFactor;
  let delayMs = options.delayMs ?? DEFAULTS.delayMs;

  const startedAt = Date.now();
  await sleep(options.initialDelayMs ?? DEFAULTS.initialDelayMs, options.signal);

  // Always poll at least once, even with a tiny timeout.
  for (;;) {
    const jobSet = await fetchJobSet();
    options.onProgress?.(jobSet);
    if (isJobSetTerminal(jobSet)) {
      return jobSet;
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed + delayMs > timeoutMs) {
      throw new PollTimeoutError(jobSetId, elapsed);
    }
    await sleep(delayMs, options.signal);
    delayMs = Math.min(Math.round(delayMs * backoffFactor), maxDelayMs);
  }
}
