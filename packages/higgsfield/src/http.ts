/**
 * HttpClient: auth headers, retry policy, error mapping, request logging.
 * Sits between the resource classes and a Transport (real fetch or mock).
 */

import { AUTH_HEADERS } from './endpoints';
import {
  AbortError,
  ApiError,
  AuthenticationError,
  HiggsfieldError,
  NetworkError,
  NotFoundError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
} from './errors';
import type { Transport, TransportResponse } from './transport';
import type { RequestLogEvent } from './types';

export interface HttpClientOptions {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  timeoutMs: number;
  maxRetries: number;
  onRequest?: (event: RequestLogEvent) => void;
}

export interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  signal?: AbortSignal;
  /**
   * Sent as the Idempotency-Key header on job-creating POSTs so automatic
   * retries can never double-charge a render. Auto-generated when omitted.
   */
  idempotencyKey?: string;
}

const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

export function generateRequestId(prefix = 'req'): string {
  // Hermes may lack crypto.randomUUID; fall back to time + randomness.
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj?.randomUUID) {
    return `${prefix}_${cryptoObj.randomUUID()}`;
  }
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

function parseRetryAfterMs(headerValue: string | undefined): number | undefined {
  if (!headerValue) return undefined;
  const seconds = Number(headerValue);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const dateMs = Date.parse(headerValue);
  if (!Number.isNaN(dateMs)) return Math.max(0, dateMs - Date.now());
  return undefined;
}

function extractApiMessage(body: unknown): string | undefined {
  if (typeof body === 'string' && body.length > 0 && body.length < 500) return body;
  if (body && typeof body === 'object') {
    const record = body as Record<string, unknown>;
    for (const key of ['message', 'detail', 'error']) {
      const value = record[key];
      if (typeof value === 'string' && value.length > 0) return value;
    }
  }
  return undefined;
}

function mapResponseError(response: TransportResponse, requestId: string): HiggsfieldError {
  const { status, json: body } = response;
  const apiMessage = extractApiMessage(body);
  const options = { status, requestId, body };

  if (status === 401 || status === 403) {
    return new AuthenticationError(
      apiMessage ?? 'Higgsfield rejected the API key/secret pair.',
      options,
    );
  }
  if (status === 400 || status === 422) {
    return new ValidationError(apiMessage ?? 'Higgsfield rejected the request payload.', options);
  }
  if (status === 404) {
    return new NotFoundError(apiMessage ?? 'Resource not found.', options);
  }
  if (status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers['retry-after']);
    return new RateLimitError(apiMessage ?? 'Rate limited by Higgsfield.', retryAfterMs, options);
  }
  if (status >= 500) {
    return new ServerError(apiMessage ?? `Higgsfield returned ${status}.`, options);
  }
  return new ApiError(apiMessage ?? `Unexpected response status ${status}.`, options);
}

function isRetryable(error: HiggsfieldError): boolean {
  if (error instanceof NetworkError || error instanceof TimeoutError) return true;
  return error.status !== undefined && RETRYABLE_STATUSES.has(error.status);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new AbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new AbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export class HttpClient {
  constructor(
    private readonly transport: Transport,
    private readonly options: HttpClientOptions,
  ) {}

  async request<T = unknown>(req: RequestOptions): Promise<T> {
    const requestId = generateRequestId();
    const url = this.buildUrl(req.path, req.query);

    const headers: Record<string, string> = {
      accept: 'application/json',
      [AUTH_HEADERS.apiKey]: this.options.apiKey,
      [AUTH_HEADERS.apiSecret]: this.options.apiSecret,
      'x-client-request-id': requestId,
    };
    if (req.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    if (req.method === 'POST') {
      headers['idempotency-key'] = req.idempotencyKey ?? generateRequestId('idem');
    }

    const maxAttempts = this.options.maxRetries + 1;
    let lastError: HiggsfieldError | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const startedAt = Date.now();
      try {
        const response = await this.transport.request({
          method: req.method,
          url,
          headers,
          body: req.body,
          timeoutMs: this.options.timeoutMs,
          signal: req.signal,
        });

        if (response.status >= 200 && response.status < 300) {
          this.log(req, response.status, attempt, startedAt, requestId);
          return response.json as T;
        }

        const error = mapResponseError(response, requestId);
        this.log(req, response.status, attempt, startedAt, requestId, error.message);
        if (attempt < maxAttempts && isRetryable(error)) {
          lastError = error;
          const retryAfterMs = error instanceof RateLimitError ? error.retryAfterMs : undefined;
          await sleep(retryAfterMs ?? backoffMs(attempt), req.signal);
          continue;
        }
        throw error;
      } catch (error) {
        if (error instanceof AbortError) throw error;
        if (!(error instanceof HiggsfieldError)) throw error;
        this.log(req, error.status, attempt, startedAt, requestId, error.message);
        if (attempt < maxAttempts && isRetryable(error)) {
          lastError = error;
          await sleep(backoffMs(attempt), req.signal);
          continue;
        }
        throw error;
      }
    }

    // Unreachable: the loop either returns or throws. Kept for exhaustiveness.
    throw lastError ?? new ApiError('Request failed', { requestId });
  }

  private buildUrl(
    pathName: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): string {
    const base = this.options.baseUrl.replace(/\/+$/, '');
    let url = `${base}${pathName}`;
    if (query) {
      const params = Object.entries(query)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      if (params.length > 0) url += `?${params.join('&')}`;
    }
    return url;
  }

  private log(
    req: RequestOptions,
    status: number | undefined,
    attempt: number,
    startedAt: number,
    requestId: string,
    error?: string,
  ): void {
    this.options.onRequest?.({
      method: req.method,
      path: req.path,
      status,
      attempt,
      durationMs: Date.now() - startedAt,
      requestId,
      error,
    });
  }
}

/** Exponential backoff with full jitter: 300ms, 600ms, 1200ms… capped at 8s. */
function backoffMs(attempt: number): number {
  const base = Math.min(300 * 2 ** (attempt - 1), 8000);
  return Math.round(base * (0.5 + Math.random() * 0.5));
}
