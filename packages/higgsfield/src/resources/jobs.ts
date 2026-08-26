/**
 * Generation requests: the unit of work every submission returns.
 * (The class keeps its historical `JobsResource` name; it operates on
 * request ids — GET /requests/{id}/status, POST /requests/{id}/cancel.)
 */

import { ENDPOINTS, estimatePath, path } from '../endpoints';
import type { HttpClient } from '../http';
import { pollRequest, toRenderResult } from '../polling';
import { parseCostEstimate, parseGenerationRequest } from '../schemas';
import type { CostEstimate, GenerationRequest, PollOptions, RenderResult } from '../types';

export class JobsResource {
  constructor(private readonly http: HttpClient) {}

  /** One status snapshot of a generation request. */
  async get(requestId: string, options?: { signal?: AbortSignal }): Promise<GenerationRequest> {
    const payload = await this.http.request({
      method: 'GET',
      path: path(ENDPOINTS.requestStatus, { id: requestId }),
      signal: options?.signal,
    });
    return parseGenerationRequest(payload);
  }

  /** Poll until the request reaches a terminal status; returns the final snapshot. */
  async waitForRequest(requestId: string, options: PollOptions = {}): Promise<GenerationRequest> {
    return pollRequest(() => this.get(requestId, { signal: options.signal }), requestId, options);
  }

  /**
   * Poll until terminal and normalize to images.
   * Throws JobFailedError when the request finished without a completed image.
   * Result URLs are pre-signed CDN links that expire (~7 days) — download promptly.
   */
  async waitForResult(requestId: string, options: PollOptions = {}): Promise<RenderResult> {
    const startedAt = Date.now();
    const request = await this.waitForRequest(requestId, options);
    return toRenderResult(request, Date.now() - startedAt);
  }

  /** Ask Higgsfield to cancel a queued request (running generations cannot be canceled). */
  async cancel(requestId: string, options?: { signal?: AbortSignal }): Promise<void> {
    await this.http.request({
      method: 'POST',
      path: path(ENDPOINTS.requestCancel, { id: requestId }),
      signal: options?.signal,
    });
  }

  /**
   * Server-side price quote: POST /estimate/{endpoint} with the exact input
   * you would submit. Billing-grade, unlike the static table in costs.ts.
   */
  async estimateRemote(
    endpoint: string,
    input: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<CostEstimate> {
    const payload = await this.http.request({
      method: 'POST',
      path: estimatePath(endpoint),
      body: input,
      signal: options?.signal,
    });
    return parseCostEstimate(payload);
  }
}
