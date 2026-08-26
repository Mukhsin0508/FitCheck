/**
 * Model presets are DATA, not types: Higgsfield's catalog churns monthly and
 * slugs have already moved between docs revisions. When a slug moves, this is
 * the only file that changes.
 *
 * Slugs double as submit paths: POST /{endpoint} with the input as the body.
 * All slugs and input contracts below were verified against the published
 * OpenAPI schema (Higgsfield API 2.0.0, docs.higgsfield.ai/docs/openapi.json,
 * snapshot in docs/higgsfield-openapi.json) and live estimates on Aug 26 2026.
 */
export const MODELS = {
  /** Soul text-to-image: { prompt*, num_images, resolution 2K|4K, aspect_ratio }. */
  soulImage: {
    endpoint: 'higgsfield-ai/soul/standard',
    defaults: { aspect_ratio: '3:4', num_images: 1 },
  },
  /** Soul v2 — newer image model, same input contract. */
  soulV2: {
    endpoint: 'higgsfield-ai/soul/v2/standard',
    defaults: { aspect_ratio: '3:4', num_images: 1 },
  },
  /**
   * One-shot persona from a single reference photo:
   * { prompt*, image_reference_url*, style_strength, batch_size, ... }.
   * The closest public thing to a Soul ID until custom references get an API.
   */
  soulReference: {
    endpoint: 'higgsfield-ai/soul/reference',
    defaults: { aspect_ratio: '3:4', batch_size: 1 },
  },
  /**
   * Try-on runs on Popcorn (Higgsfield's multi-image editing model):
   * { prompt*, image_urls: [person, garment], num_images, resolution
   * 720p|1600p, aspect_ratio, seed }. ~$0.092/image (live estimate).
   * Override via HiggsfieldClientOptions.tryOnEndpoint if a dedicated
   * try-on model ships later.
   */
  tryOn: {
    endpoint: 'higgsfield-ai/popcorn/auto',
    defaults: { aspect_ratio: '3:4', num_images: 1, resolution: '720p' },
  },
} as const satisfies Record<string, { endpoint: string; defaults: Record<string, unknown> }>;

export type ModelPreset = keyof typeof MODELS;
