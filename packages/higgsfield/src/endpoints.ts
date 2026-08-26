/**
 * Every Higgsfield endpoint path and auth header the client touches, in one place.
 *
 * ── PROVISIONAL ─────────────────────────────────────────────────────────────
 * These paths follow the publicly documented platform.higgsfield.ai layout as
 * of August 2026. When the official OpenAPI schema lands, regenerate THIS FILE
 * (and `schemas.ts`) against it — nothing else in the package hardcodes a path.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_BASE_URL = 'https://platform.higgsfield.ai';

/** Header names Higgsfield uses for API authentication. */
export const AUTH_HEADERS = {
  apiKey: 'hf-api-key',
  apiSecret: 'hf-secret',
} as const;

export const ENDPOINTS = {
  /** Submit a Soul text-to-image / image-to-image generation. */
  soulGenerate: '/v1/text2image/soul',
  /** Submit an outfit-swap (try-on) render: person/avatar + garment image. */
  tryOn: '/v1/image2image/soul-outfit',
  /** Create a Soul ID (personal avatar) from reference selfies. */
  soulCreate: '/v1/souls',
  /** Read one Soul ID. `:id` is replaced by the client. */
  soulGet: '/v1/souls/:id',
  /** List Soul IDs on the account. */
  soulList: '/v1/souls',
  /** Delete a Soul ID and its reference images. */
  soulDelete: '/v1/souls/:id',
  /** Read a job set (the unit of work every generation returns). */
  jobSetGet: '/v1/job-sets/:id',
  /** Cancel a queued/running job set. */
  jobSetCancel: '/v1/job-sets/:id/cancel',
} as const;

export type EndpointName = keyof typeof ENDPOINTS;

/** Replace `:param` segments, e.g. `path(ENDPOINTS.jobSetGet, { id })`. */
export function path(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z_]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path param ":${name}" for ${template}`);
    }
    return encodeURIComponent(value);
  });
}
