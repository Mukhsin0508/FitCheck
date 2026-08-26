/**
 * In-memory mock of the Higgsfield API, implemented at the transport layer so
 * everything above it (auth headers, retries, error mapping, polling) runs
 * exactly as in production. Used by tests and by FitCheck's demo mode.
 */

import { ENDPOINTS } from './endpoints';
import type { Transport, TransportRequest, TransportResponse } from './transport';

export interface MockTransportOptions {
  /** Simulated network latency per request, ms. Default 0 (tests). */
  latencyMs?: number;
  /** How many GET polls a job set stays non-terminal. Default 2. */
  pollsToComplete?: number;
  /** Terminal status for new job sets. Default 'completed'. */
  jobOutcome?: 'completed' | 'failed' | 'nsfw';
  /** Produces result URLs for completed jobs. */
  resultUrl?: (jobId: string) => string;
}

interface MockJob {
  id: string;
  polls: number;
  outcome: 'completed' | 'failed' | 'nsfw';
}

/** Queue an HTTP failure for the next request(s) — for retry tests. */
export interface QueuedFailure {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
}

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${(++seq).toString(36)}${Date.now().toString(36)}`;

export class MockTransport implements Transport {
  readonly requests: TransportRequest[] = [];
  private readonly jobSets = new Map<string, MockJob[]>();
  private readonly souls = new Map<string, { name?: string; polls: number }>();
  private readonly failureQueue: QueuedFailure[] = [];
  private readonly options: Required<Pick<MockTransportOptions, 'latencyMs' | 'pollsToComplete' | 'jobOutcome'>> &
    MockTransportOptions;

  constructor(options: MockTransportOptions = {}) {
    this.options = {
      latencyMs: options.latencyMs ?? 0,
      pollsToComplete: options.pollsToComplete ?? 2,
      jobOutcome: options.jobOutcome ?? 'completed',
      ...options,
    };
  }

  queueFailure(failure: QueuedFailure): void {
    this.failureQueue.push(failure);
  }

  async request(req: TransportRequest): Promise<TransportResponse> {
    this.requests.push(req);
    if (this.options.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.options.latencyMs));
    }

    const queued = this.failureQueue.shift();
    if (queued) {
      return {
        status: queued.status,
        headers: { ...(queued.headers ?? {}) },
        json: queued.body ?? { message: `mock failure ${queued.status}` },
      };
    }

    const { pathname } = new URL(req.url);

    if (req.method === 'POST' && (pathname === ENDPOINTS.tryOn || pathname === ENDPOINTS.soulGenerate)) {
      return this.createJobSet();
    }
    if (req.method === 'POST' && pathname === ENDPOINTS.soulCreate) {
      const body = (req.body ?? {}) as { name?: string };
      const id = nextId('soul');
      this.souls.set(id, { name: body.name, polls: 0 });
      return ok({ id, name: body.name, status: 'in_progress' });
    }

    const jobSetMatch = pathname.match(/^\/v1\/job-sets\/([^/]+)$/);
    if (req.method === 'GET' && jobSetMatch) {
      return this.getJobSet(jobSetMatch[1] as string);
    }
    const cancelMatch = pathname.match(/^\/v1\/job-sets\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && cancelMatch) {
      const jobs = this.jobSets.get(cancelMatch[1] as string);
      if (!jobs) return notFound();
      for (const job of jobs) {
        job.outcome = 'failed';
        job.polls = this.options.pollsToComplete;
      }
      return ok({ ok: true });
    }

    const soulMatch = pathname.match(/^\/v1\/souls\/([^/]+)$/);
    if (soulMatch) {
      const id = soulMatch[1] as string;
      const soul = this.souls.get(id);
      if (!soul) return notFound();
      if (req.method === 'DELETE') {
        this.souls.delete(id);
        return ok({ ok: true });
      }
      soul.polls += 1;
      const status = soul.polls >= this.options.pollsToComplete ? 'completed' : 'in_progress';
      return ok({ id, name: soul.name, status });
    }
    if (req.method === 'GET' && pathname === ENDPOINTS.soulList) {
      return ok({
        items: [...this.souls.entries()].map(([id, soul]) => ({
          id,
          name: soul.name,
          status: soul.polls >= this.options.pollsToComplete ? 'completed' : 'in_progress',
        })),
      });
    }

    return notFound();
  }

  private createJobSet(): TransportResponse {
    const jobSetId = nextId('jobset');
    const job: MockJob = { id: nextId('job'), polls: 0, outcome: this.options.jobOutcome };
    this.jobSets.set(jobSetId, [job]);
    return ok({ id: jobSetId, jobs: [{ id: job.id, status: 'queued' }] });
  }

  private getJobSet(jobSetId: string): TransportResponse {
    const jobs = this.jobSets.get(jobSetId);
    if (!jobs) return notFound();

    const payloadJobs = jobs.map((job) => {
      job.polls += 1;
      if (job.polls < this.options.pollsToComplete) {
        return { id: job.id, status: job.polls === 1 ? 'queued' : 'in_progress' };
      }
      if (job.outcome !== 'completed') {
        return { id: job.id, status: job.outcome, error: `mock ${job.outcome}` };
      }
      const url =
        this.options.resultUrl?.(job.id) ?? `https://mock.higgsfield.local/renders/${job.id}.jpg`;
      return {
        id: job.id,
        status: 'completed',
        results: { raw: { url, type: 'image/jpeg' }, min: { url, type: 'image/jpeg' } },
      };
    });

    return ok({ id: jobSetId, jobs: payloadJobs });
  }
}

function ok(json: unknown): TransportResponse {
  return { status: 200, headers: {}, json };
}

function notFound(): TransportResponse {
  return { status: 404, headers: {}, json: { message: 'not found (mock)' } };
}
