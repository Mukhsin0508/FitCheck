/**
 * Every Higgsfield endpoint path and auth header the client touches, in one place.
 *
 * ── PROVISIONAL ─────────────────────────────────────────────────────────────
 * Matches the @higgsfield/client v2 wire protocol, verified against the
 * OpenBinge integration (Aug 2026). Key facts, from the platform openapi.json:
 *   - Base URL https://platform.higgsfield.ai — NO /v1 prefix anywhere.
 *   - Auth is a single header: `authorization: Key <KEY_ID:KEY_SECRET>`.
 *   - Submit is POST /{endpointSlug} (slugs are model ids like
 *     'higgsfield-ai/soul/standard'); slugs live in `models.ts`, not here.
 * When the official OpenAPI schema is published, re-verify THIS FILE (and
 * `schemas.ts`) against it — nothing else in the package hardcodes a path.
 * ────────────────────────────────────────────────────────────────────────────
 */

export const DEFAULT_BASE_URL = 'https://platform.higgsfield.ai';

/**
 * Header names Higgsfield uses for API authentication.
 * One header only: `authorization: Key <KEY_ID:KEY_SECRET>`.
 */
export const AUTH_HEADERS = {
  authorization: 'authorization',
} as const;

/** Build the value for the {@link AUTH_HEADERS.authorization} header. */
export function authHeaderValue(credentials: string): string {
  return `Key ${credentials}`;
}

export const ENDPOINTS = {
  /** Read one generation request. `:id` is replaced by the client. */
  requestStatus: '/requests/:id/status',
  /** Cancel a queued generation request (running ones cannot be canceled). */
  requestCancel: '/requests/:id/cancel',
  /** POST {content_type} → {public_url, upload_url, upload_headers}; PUT bytes to upload_url. */
  uploads: '/uploads',
} as const;

export type EndpointName = keyof typeof ENDPOINTS;

/** Submissions POST directly to the endpoint slug: `/{endpointSlug}`. */
export function submitPath(endpointSlug: string): string {
  return `/${endpointSlug.replace(/^\/+/, '')}`;
}

/**
 * Server-side price estimate for a submission. Slugs contain slashes, so this
 * cannot go through {@link path} (which URL-encodes params).
 */
export function estimatePath(endpointSlug: string): string {
  return `/estimate/${endpointSlug.replace(/^\/+/, '')}`;
}

/** Replace `:param` segments, e.g. `path(ENDPOINTS.requestStatus, { id })`. */
export function path(template: string, params: Record<string, string> = {}): string {
  return template.replace(/:([A-Za-z_]+)/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) {
      throw new Error(`Missing path param ":${name}" for ${template}`);
    }
    return encodeURIComponent(value);
  });
}
