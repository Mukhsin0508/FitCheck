/** Job sets: the unit of work every generation call returns. */

import { ENDPOINTS, path } from '../endpoints';
import type { HttpClient } from '../http';
import { pollJobSet, toRenderResult } from '../polling';
import { parseJobSet } from '../schemas';
import type { JobSet, PollOptions, RenderResult } from '../types';

export class JobsResource {
  constructor(private readonly http: HttpClient) {}

  /** One snapshot of a job set. */
  async get(jobSetId: string, options?: { signal?: AbortSignal }): Promise<JobSet> {
    const payload = await this.http.request({
      method: 'GET',
      path: path(ENDPOINTS.jobSetGet, { id: jobSetId }),
      signal: options?.signal,
    });
    return parseJobSet(payload);
  }

  /** Poll until every job in the set is terminal. */
  async waitForJobSet(jobSetId: string, options: PollOptions = {}): Promise<JobSet> {
    return pollJobSet(() => this.get(jobSetId, { signal: options.signal }), jobSetId, options);
  }

  /**
   * Poll until terminal and normalize to images.
   * Throws JobFailedError when the set finished without a completed image.
   */
  async waitForResult(jobSetId: string, options: PollOptions = {}): Promise<RenderResult> {
    const startedAt = Date.now();
    const jobSet = await this.waitForJobSet(jobSetId, options);
    return toRenderResult(jobSet, Date.now() - startedAt);
  }

  /** Ask Higgsfield to cancel a queued or running job set. */
  async cancel(jobSetId: string, options?: { signal?: AbortSignal }): Promise<void> {
    await this.http.request({
      method: 'POST',
      path: path(ENDPOINTS.jobSetCancel, { id: jobSetId }),
      signal: options?.signal,
    });
  }
}
