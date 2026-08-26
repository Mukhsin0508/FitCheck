/**
 * In-memory mock of the Higgsfield platform API, implemented at the transport
 * layer so everything above it (auth headers, retries, error mapping, polling)
 * runs exactly as in production. Used by tests and by FitCheck's demo mode.
 *
 * Speaks the real wire protocol:
 *   - POST /{endpointSlug}            → { request_id, status: 'queued', ... }
 *   - GET  /requests/{id}/status      → advances to the configured outcome
 *   - POST /requests/{id}/cancel      → subsequent polls report 'canceled'
 *   - POST /estimate/{endpointSlug}   → { credits, usd } (strings, like the API)
 *   - POST /uploads                   → { public_url, upload_url, upload_headers }
 * Non-terminal polls return the wire aliases 'in_queue' / 'processing' so the
 * client's status normalization is exercised on every run.
 */

import type { Transport, TransportRequest, TransportResponse } from './transport';

export interface MockTransportOptions {
  /** Simulated network latency per request, ms. Default 0 (tests). */
  latencyMs?: number;
  /** How many GET status polls a request stays non-terminal. Default 2. */
  pollsToComplete?: number;
  /** Terminal status for new requests. Default 'completed'. */
  jobOutcome?: 'completed' | 'failed' | 'nsfw' | 'canceled';
  /** Produces result URLs for completed requests. */
  resultUrl?: (requestId: string) => string;
  /** What POST /estimate/{endpoint} reports. Default { credits: 9, usd: 0.09 }. */
  estimate?: { credits: number; usd: number };
}

interface MockRequest {
  id: string;
  endpoint: string;
  polls: number;
  outcome: 'completed' | 'failed' | 'nsfw' | 'canceled';
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
  private readonly generations = new Map<string, MockRequest>();
  private readonly failureQueue: QueuedFailure[] = [];
  private readonly options: Required<
    Pick<MockTransportOptions, 'latencyMs' | 'pollsToComplete' | 'jobOutcome' | 'estimate'>
  > &
    MockTransportOptions;

  constructor(options: MockTransportOptions = {}) {
    this.options = {
      latencyMs: options.latencyMs ?? 0,
      pollsToComplete: options.pollsToComplete ?? 2,
      jobOutcome: options.jobOutcome ?? 'completed',
      estimate: options.estimate ?? { credits: 9, usd: 0.09 },
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
        json: queued.body ?? { detail: `mock failure ${queued.status}` },
      };
    }

    const { pathname } = new URL(req.url);

    const statusMatch = pathname.match(/^\/requests\/([^/]+)\/status$/);
    if (req.method === 'GET' && statusMatch) {
      return this.getStatus(statusMatch[1] as string);
    }

    const cancelMatch = pathname.match(/^\/requests\/([^/]+)\/cancel$/);
    if (req.method === 'POST' && cancelMatch) {
      const generation = this.generations.get(cancelMatch[1] as string);
      if (!generation) return notFound();
      generation.outcome = 'canceled';
      generation.polls = Math.max(generation.polls, this.options.pollsToComplete);
      return ok({ ok: true });
    }

    if (req.method === 'POST' && pathname.startsWith('/estimate/')) {
      // The real API returns strings; parseCostEstimate normalizes them.
      return ok({
        credits: String(this.options.estimate.credits),
        usd: String(this.options.estimate.usd),
      });
    }

    if (req.method === 'POST' && pathname === '/files/generate-upload-url') {
      const id = nextId('upload');
      return ok({
        public_url: `https://mock.higgsfield.local/uploads/${id}`,
        upload_url: `https://mock.higgsfield.local/put/${id}`,
        upload_headers: {},
      });
    }

    // Anything else POSTed is a submission: POST /{endpointSlug}.
    if (req.method === 'POST' && pathname.length > 1) {
      return this.submit(pathname.slice(1));
    }

    return notFound();
  }

  private submit(endpoint: string): TransportResponse {
    const id = nextId('req');
    this.generations.set(id, { id, endpoint, polls: 0, outcome: this.options.jobOutcome });
    return ok({
      request_id: id,
      status: 'queued',
      status_url: `https://platform.higgsfield.ai/requests/${id}/status`,
      cancel_url: `https://platform.higgsfield.ai/requests/${id}/cancel`,
      error: null,
    });
  }

  private getStatus(requestId: string): TransportResponse {
    const generation = this.generations.get(requestId);
    if (!generation) return notFound();

    generation.polls += 1;
    if (generation.polls < this.options.pollsToComplete) {
      // Wire aliases on purpose — exercises normalizeStatus in every test run.
      return ok({
        request_id: generation.id,
        status: generation.polls === 1 ? 'in_queue' : 'processing',
        error: null,
      });
    }
    if (generation.outcome !== 'completed') {
      return ok({
        request_id: generation.id,
        // 'canceled' goes out as the wire alias 'cancelled'.
        status: generation.outcome === 'canceled' ? 'cancelled' : generation.outcome,
        error: `mock ${generation.outcome}`,
      });
    }
    const url =
      this.options.resultUrl?.(generation.id) ??
      `https://mock.higgsfield.local/renders/${generation.id}.jpg`;
    return ok({
      request_id: generation.id,
      status: 'completed',
      error: null,
      images: [{ url, content_type: 'image/jpeg' }],
    });
  }
}

function ok(json: unknown): TransportResponse {
  return { status: 200, headers: {}, json };
}

function notFound(): TransportResponse {
  return { status: 404, headers: {}, json: { detail: 'not found (mock)' } };
}
