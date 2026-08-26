/**
 * Response validation. Deliberately tolerant: every object is "loose" so new
 * fields from the API never break the client, and unknown job statuses are
 * normalized instead of rejected.
 *
 * PROVISIONAL — regenerate alongside `endpoints.ts` when the OpenAPI schema
 * for platform.higgsfield.ai is available.
 */

import { z } from 'zod';
import type { Job, JobSet, JobStatus } from './types';

const KNOWN_STATUSES: readonly JobStatus[] = [
  'queued',
  'in_progress',
  'completed',
  'failed',
  'nsfw',
  'canceled',
];

/** Map raw API status strings (and their aliases) onto the normalized set. */
export function normalizeStatus(raw: unknown): JobStatus {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.toLowerCase();
  if ((KNOWN_STATUSES as readonly string[]).includes(value)) return value as JobStatus;
  switch (value) {
    case 'pending':
    case 'created':
      return 'queued';
    case 'processing':
    case 'running':
      return 'in_progress';
    case 'succeeded':
    case 'success':
    case 'done':
      return 'completed';
    case 'error':
      return 'failed';
    case 'cancelled':
      return 'canceled';
    default:
      return 'unknown';
  }
}

const mediaRefSchema = z.looseObject({
  url: z.string(),
  type: z.string().optional(),
});

const jobSchema = z.looseObject({
  id: z.string(),
  status: z.unknown(),
  results: z
    .looseObject({
      raw: mediaRefSchema.optional().nullable(),
      min: mediaRefSchema.optional().nullable(),
    })
    .optional()
    .nullable(),
  error: z.string().optional().nullable(),
});

const jobSetSchema = z.looseObject({
  id: z.string(),
  jobs: z.array(jobSchema).default([]),
});

/** Some endpoints wrap the job set: `{ job_set: {...} }` or `{ jobSet: {...} }`. */
const jobSetEnvelopeSchema = z.union([
  jobSetSchema,
  z.looseObject({ job_set: jobSetSchema }).transform((value) => value.job_set),
  z.looseObject({ jobSet: jobSetSchema }).transform((value) => value.jobSet),
]);

export function parseJobSet(payload: unknown): JobSet {
  const raw = jobSetEnvelopeSchema.parse(payload);
  const jobs: Job[] = raw.jobs.map((job) => ({
    id: job.id,
    status: normalizeStatus(job.status),
    results: job.results
      ? {
          raw: job.results.raw ?? undefined,
          min: job.results.min ?? undefined,
        }
      : undefined,
    error: job.error ?? undefined,
  }));
  return { id: raw.id, jobs };
}

const soulSchema = z.looseObject({
  id: z.string(),
  name: z.string().optional().nullable(),
  status: z.unknown().optional(),
});

export interface Soul {
  id: string;
  name?: string;
  status: JobStatus;
}

export function parseSoul(payload: unknown): Soul {
  const raw = soulSchema.parse(payload);
  return {
    id: raw.id,
    name: raw.name ?? undefined,
    status: normalizeStatus(raw.status),
  };
}

const soulListSchema = z.union([
  z.array(soulSchema),
  z.looseObject({ items: z.array(soulSchema) }).transform((value) => value.items),
  z.looseObject({ souls: z.array(soulSchema) }).transform((value) => value.souls),
]);

export function parseSoulList(payload: unknown): Soul[] {
  return soulListSchema.parse(payload).map((raw) => ({
    id: raw.id,
    name: raw.name ?? undefined,
    status: normalizeStatus(raw.status),
  }));
}
