/**
 * Response validation. Deliberately tolerant: every object is "loose" so new
 * fields from the API never break the client, and unknown request statuses are
 * normalized instead of rejected.
 *
 * Parses the flat GenerationRequest wire shape of the platform API
 * (@higgsfield/client v2 protocol) — { request_id, status, images?, ... },
 * no job-set envelope.
 */

import { z } from 'zod';
import type { CostEstimate, GenerationRequest, JobStatus, MediaRef } from './types';
import { ApiError } from './errors';

const KNOWN_STATUSES: readonly JobStatus[] = [
  'queued',
  'in_progress',
  'completed',
  'failed',
  'nsfw',
  'canceled',
];

/**
 * Map raw API status strings onto the normalized set. The wire aliases are
 * documented: in_queue → queued, processing → in_progress,
 * cancelled → canceled. The rest are defensive tolerance.
 */
export function normalizeStatus(raw: unknown): JobStatus {
  if (typeof raw !== 'string') return 'unknown';
  const value = raw.toLowerCase();
  if ((KNOWN_STATUSES as readonly string[]).includes(value)) return value as JobStatus;
  switch (value) {
    case 'in_queue':
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

const mediaSchema = z.looseObject({
  url: z.string(),
  content_type: z.string().optional().nullable(),
});

function toMediaRef(raw: z.infer<typeof mediaSchema>): MediaRef {
  return { url: raw.url, type: raw.content_type ?? undefined };
}

const generationRequestSchema = z.looseObject({
  request_id: z.string(),
  status: z.unknown(),
  status_url: z.string().optional().nullable(),
  cancel_url: z.string().optional().nullable(),
  error: z.string().optional().nullable(),
  images: z.array(mediaSchema).optional().nullable(),
  video: mediaSchema.optional().nullable(),
  audio: mediaSchema.optional().nullable(),
  audios: z.array(mediaSchema).optional().nullable(),
});

export function parseGenerationRequest(payload: unknown): GenerationRequest {
  const raw = generationRequestSchema.parse(payload);
  return {
    request_id: raw.request_id,
    status: normalizeStatus(raw.status),
    status_url: raw.status_url ?? undefined,
    cancel_url: raw.cancel_url ?? undefined,
    error: raw.error ?? null,
    images: raw.images ? raw.images.map(toMediaRef) : undefined,
    video: raw.video ? toMediaRef(raw.video) : undefined,
    audio: raw.audio ? toMediaRef(raw.audio) : undefined,
    audios: raw.audios ? raw.audios.map(toMediaRef) : undefined,
  };
}

/** POST /estimate/{endpoint} returns strings (sometimes numbers); normalize to numbers. */
const estimateSchema = z.looseObject({
  credits: z.union([z.string(), z.number()]),
  usd: z.union([z.string(), z.number()]),
});

export function parseCostEstimate(payload: unknown): CostEstimate {
  const raw = estimateSchema.parse(payload);
  const credits = typeof raw.credits === 'number' ? raw.credits : Number.parseFloat(raw.credits);
  const usd = typeof raw.usd === 'number' ? raw.usd : Number.parseFloat(raw.usd);
  if (!Number.isFinite(credits) || !Number.isFinite(usd)) {
    throw new ApiError(`Unexpected estimate response: ${JSON.stringify(payload).slice(0, 300)}`);
  }
  return { credits, usd };
}

/* ── Souls (PROVISIONAL — no public Soul ID API yet; used only when a custom
      soulsBasePath is configured) ─────────────────────────────────────────── */

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
