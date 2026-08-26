/**
 * Error taxonomy for the Higgsfield client.
 *
 * Every error thrown by the client extends {@link HiggsfieldError}, so callers
 * can catch one type and branch on `code` — or catch the specific subclasses.
 */

export type HiggsfieldErrorCode =
  | 'authentication'
  | 'insufficient_credits'
  | 'validation'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'timeout'
  | 'aborted'
  | 'poll_timeout'
  | 'job_failed'
  | 'api';

export interface HiggsfieldErrorOptions {
  /** HTTP status, when the error came from a response. */
  status?: number;
  /** Request id echoed by the API (or generated client-side), for support tickets. */
  requestId?: string;
  /** Parsed response body, when available. Never includes credentials. */
  body?: unknown;
  cause?: unknown;
}

export class HiggsfieldError extends Error {
  readonly code: HiggsfieldErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(code: HiggsfieldErrorCode, message: string, options: HiggsfieldErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'HiggsfieldError';
    this.code = code;
    this.status = options.status;
    this.requestId = options.requestId;
    this.body = options.body;
  }
}

/** 401 — the KEY_ID:KEY_SECRET pair is missing, malformed, or revoked. Never retried. */
export class AuthenticationError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('authentication', message, options);
    this.name = 'AuthenticationError';
  }
}

/** 403 — the account balance cannot cover this generation. Never retried. */
export class InsufficientCreditsError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('insufficient_credits', message, options);
    this.name = 'InsufficientCreditsError';
  }
}

/** 400/422 — the API rejected the request payload. Never retried. */
export class ValidationError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('validation', message, options);
    this.name = 'ValidationError';
  }
}

/** 404 — unknown job set, soul, or endpoint. */
export class NotFoundError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('not_found', message, options);
    this.name = 'NotFoundError';
  }
}

/** 429 — rate limited. Retried automatically; thrown once retries are exhausted. */
export class RateLimitError extends HiggsfieldError {
  /** How long the API asked us to wait, when it said (from Retry-After). */
  readonly retryAfterMs?: number;

  constructor(message: string, retryAfterMs?: number, options?: HiggsfieldErrorOptions) {
    super('rate_limited', message, options);
    this.name = 'RateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** 5xx — Higgsfield-side failure. Retried automatically; thrown once retries are exhausted. */
export class ServerError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('server', message, options);
    this.name = 'ServerError';
  }
}

/** DNS/TLS/socket failures — the request never got an HTTP response. Retried. */
export class NetworkError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('network', message, options);
    this.name = 'NetworkError';
  }
}

/** A single HTTP attempt exceeded `timeoutMs`. Retried like a network error. */
export class TimeoutError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('timeout', message, options);
    this.name = 'TimeoutError';
  }
}

/** The caller's AbortSignal fired. Never retried. */
export class AbortError extends HiggsfieldError {
  constructor(message = 'Request aborted by caller', options?: HiggsfieldErrorOptions) {
    super('aborted', message, options);
    this.name = 'AbortError';
  }
}

/** Polling a job set exceeded the configured overall deadline. */
export class PollTimeoutError extends HiggsfieldError {
  readonly jobSetId: string;

  constructor(jobSetId: string, waitedMs: number, options?: HiggsfieldErrorOptions) {
    super('poll_timeout', `Job set ${jobSetId} did not finish within ${waitedMs}ms`, options);
    this.name = 'PollTimeoutError';
    this.jobSetId = jobSetId;
  }
}

/** The request reached a terminal state but produced no usable image. */
export class JobFailedError extends HiggsfieldError {
  /** The generation's request_id (field name kept for compatibility). */
  readonly jobSetId: string;
  /** Terminal status(es) observed, e.g. ['failed'] or ['nsfw']. */
  readonly jobStatuses: string[];

  constructor(jobSetId: string, jobStatuses: string[], options?: HiggsfieldErrorOptions) {
    super('job_failed', `Request ${jobSetId} finished without a result (${jobStatuses.join(', ')})`, options);
    this.name = 'JobFailedError';
    this.jobSetId = jobSetId;
    this.jobStatuses = jobStatuses;
  }
}

/** Anything else the API returned that we don't have a sharper class for. */
export class ApiError extends HiggsfieldError {
  constructor(message: string, options?: HiggsfieldErrorOptions) {
    super('api', message, options);
    this.name = 'ApiError';
  }
}
