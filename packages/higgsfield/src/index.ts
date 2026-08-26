export { HiggsfieldClient } from './client';

export {
  AbortError,
  ApiError,
  AuthenticationError,
  HiggsfieldError,
  JobFailedError,
  NetworkError,
  NotFoundError,
  PollTimeoutError,
  RateLimitError,
  ServerError,
  TimeoutError,
  ValidationError,
  type HiggsfieldErrorCode,
} from './errors';

export { DEFAULT_BASE_URL, ENDPOINTS, AUTH_HEADERS } from './endpoints';
export { MODEL_COSTS_USD, DEFAULT_COST_USD, estimateCostUsd } from './costs';
export { MockTransport, type MockTransportOptions } from './mock';
export { FetchTransport, type Transport, type TransportRequest, type TransportResponse } from './transport';
export { isJobSetTerminal, toRenderResult } from './polling';
export { normalizeStatus, parseJobSet, type Soul } from './schemas';

export type { CreateTryOnParams } from './resources/tryon';
export type { CreateSoulParams } from './resources/souls';
export type { GenerateImageParams } from './resources/images';

export {
  TERMINAL_STATUSES,
  toImageInput,
  type GarmentCategory,
  type HiggsfieldClientOptions,
  type ImageInput,
  type ImageInputLike,
  type Job,
  type JobSet,
  type JobStatus,
  type MediaRef,
  type PollOptions,
  type RenderResult,
  type RenderedImage,
  type RequestLogEvent,
  type UsageEvent,
} from './types';
