/**
 * Model presets are DATA, not types: Higgsfield's catalog churns monthly and
 * slugs have already moved between docs revisions. When a slug moves, this is
 * the only file that changes.
 *
 * Slugs double as submit paths: POST /{endpoint} with the input as the body.
 */
export const MODELS = {
  /** Soul text-to-image — the documented, verified image endpoint. */
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
   * ⚠️ UNVERIFIED SLUG — the try-on (outfit-swap) endpoint is NOT in the
   * public platform docs yet. 'higgsfield-ai/fashion-factory' is our best
   * guess from product naming; the real slug may differ when it ships.
   * Override it without touching code via
   * `HiggsfieldClientOptions.tryOnEndpoint` (or per resource).
   */
  tryOn: {
    endpoint: 'higgsfield-ai/fashion-factory',
    defaults: {},
  },
} as const satisfies Record<string, { endpoint: string; defaults: Record<string, unknown> }>;

export type ModelPreset = keyof typeof MODELS;
