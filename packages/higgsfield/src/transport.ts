/**
 * Raw I/O layer. `HttpClient` (http.ts) owns auth, retries, and error mapping;
 * a Transport only moves one request and reports what happened.
 *
 * Works in Node 18+, browsers, and React Native (Hermes) — no AbortSignal.any
 * or AbortSignal.timeout, both missing from Hermes.
 */

import { AbortError, NetworkError, TimeoutError } from './errors';

export interface TransportRequest {
  method: 'GET' | 'POST' | 'DELETE';
  /** Absolute URL — HttpClient joins baseUrl + path before calling. */
  url: string;
  headers: Record<string, string>;
  /** JSON-serializable body for POST. */
  body?: unknown;
  /** Per-attempt timeout in ms. */
  timeoutMs: number;
  /** Caller cancellation. */
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  /** Parsed JSON body, or undefined when the body was empty/not JSON. */
  json: unknown;
}

export interface Transport {
  request(req: TransportRequest): Promise<TransportResponse>;
}

export class FetchTransport implements Transport {
  private readonly fetchFn: typeof globalThis.fetch;

  constructor(fetchFn?: typeof globalThis.fetch) {
    const fn = fetchFn ?? globalThis.fetch;
    if (!fn) {
      throw new Error('No fetch implementation available; pass one via HiggsfieldClient options.');
    }
    // Bind to avoid "Illegal invocation" when fetch is unbound from globalThis.
    this.fetchFn = fn.bind(globalThis);
  }

  async request(req: TransportRequest): Promise<TransportResponse> {
    if (req.signal?.aborted) {
      throw new AbortError();
    }

    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, req.timeoutMs);

    const onCallerAbort = () => controller.abort();
    req.signal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      const response = await this.fetchFn(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: controller.signal,
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });

      let json: unknown;
      const text = await response.text();
      if (text.length > 0) {
        try {
          json = JSON.parse(text);
        } catch {
          json = text; // Non-JSON body (HTML error page, plain text) — surface as-is.
        }
      }

      return { status: response.status, headers, json };
    } catch (error) {
      if (req.signal?.aborted) {
        throw new AbortError('Request aborted by caller', { cause: error });
      }
      if (timedOut) {
        throw new TimeoutError(`Request timed out after ${req.timeoutMs}ms`, { cause: error });
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new NetworkError(`Network request failed: ${message}`, { cause: error });
    } finally {
      clearTimeout(timer);
      req.signal?.removeEventListener('abort', onCallerAbort);
    }
  }
}
