/**
 * Client-side cost estimates per rendered image, in USD.
 *
 * These power FitCheck's render-cost discipline (log cost per render, cap free
 * users): good enough for dashboards, not billing-grade. Reconcile against
 * Higgsfield invoices. Sources: public pricing research, Aug 2026 —
 * Higgsfield Soul ≈ $0.09/image; FASHN $0.075; Kling try-on $0.07.
 */

export const MODEL_COSTS_USD: Record<string, number> = {
  soul: 0.09,
  'soul-outfit': 0.09,
  soul_2: 0.09,
};

export const DEFAULT_COST_USD = 0.09;

export function estimateCostUsd(model: string, imageCount = 1): number {
  const perImage = MODEL_COSTS_USD[model] ?? DEFAULT_COST_USD;
  return Number((perImage * imageCount).toFixed(4));
}
