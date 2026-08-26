import { describe, expect, it, vi } from 'vitest';

import {
  AbortError,
  ApiError,
  AuthenticationError,
  HiggsfieldClient,
  InsufficientCreditsError,
  JobFailedError,
  MODELS,
  MockTransport,
  PollTimeoutError,
  ValidationError,
  estimateCostUsd,
  normalizeStatus,
  type RequestLogEvent,
  type UsageEvent,
} from '../src';
import { path, ENDPOINTS, AUTH_HEADERS, estimatePath, submitPath } from '../src/endpoints';

const FAST_POLL = { initialDelayMs: 0, delayMs: 1, maxDelayMs: 2 };

function pathnameOf(url: string): string {
  return new URL(url).pathname;
}

describe('tryon.renderAndWait', () => {
  it('submits to the try-on slug, polls /requests/{id}/status, and returns the image', async () => {
    const usage: UsageEvent[] = [];
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, { onUsage: (e) => usage.push(e) });

    const result = await hf.tryon.renderAndWait(
      { soulId: 'soul_demo', garmentImage: 'https://cdn.example.com/dress.jpg', category: 'dress' },
      FAST_POLL,
    );

    expect(result.images).toHaveLength(1);
    expect(result.images[0]!.url).toMatch(/^https:\/\/mock\.higgsfield\.local\/renders\//);
    expect(result.jobSetId).toBeTruthy();

    // The wire: POST /{endpointSlug}, then GET /requests/{id}/status until terminal.
    expect(pathnameOf(transport.requests[0]!.url)).toBe(`/${MODELS.tryOn.endpoint}`);
    expect(pathnameOf(transport.requests[1]!.url)).toBe(
      `/requests/${result.jobSetId}/status`,
    );

    // Spend accounting fired once, carrying the endpoint slug as the model.
    expect(usage).toHaveLength(1);
    expect(usage[0]!.operation).toBe('tryon');
    expect(usage[0]!.model).toBe(MODELS.tryOn.endpoint);
    expect(usage[0]!.estimatedCostUsd).toBe(estimateCostUsd(MODELS.tryOn.endpoint, 1));
  });

  it('sends the input as a flat JSON body (no params envelope)', async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport);
    await hf.tryon.create({
      soulId: 'soul_1',
      garmentImage: 'https://cdn.example.com/g.jpg',
      category: 'dress',
    });

    const body = transport.requests[0]!.body as Record<string, unknown>;
    expect(body['params']).toBeUndefined();
    expect(body['soul_id']).toBe('soul_1');
    expect(body['garment_image']).toBe('https://cdn.example.com/g.jpg');
    expect(body['category']).toBe('dress');
  });

  it('honors a tryOnEndpoint override (the default slug is unverified)', async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, {
      tryOnEndpoint: 'higgsfield-ai/tryon/real-slug',
    });
    await hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' });
    expect(pathnameOf(transport.requests[0]!.url)).toBe('/higgsfield-ai/tryon/real-slug');
  });

  it('requires a person: soulId or personImage', async () => {
    const hf = HiggsfieldClient.mock();
    await expect(
      hf.tryon.create({ garmentImage: 'https://cdn.example.com/dress.jpg' }),
    ).rejects.toThrow(TypeError);
  });

  it('surfaces an nsfw terminal status as JobFailedError', async () => {
    const hf = HiggsfieldClient.mock({ jobOutcome: 'nsfw' });
    await expect(
      hf.tryon.renderAndWait(
        { soulId: 'soul_demo', garmentImage: 'https://cdn.example.com/top.jpg' },
        FAST_POLL,
      ),
    ).rejects.toMatchObject({ name: 'JobFailedError', jobStatuses: ['nsfw'] });
  });

  it('times out when the request never finishes', async () => {
    const hf = HiggsfieldClient.mock({ pollsToComplete: 10_000 });
    await expect(
      hf.tryon.renderAndWait(
        { soulId: 'soul_demo', garmentImage: 'https://cdn.example.com/top.jpg' },
        { ...FAST_POLL, timeoutMs: 25 },
      ),
    ).rejects.toThrow(PollTimeoutError);
  });

  it("sends the single 'authorization: Key <id:secret>' header", async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, {
      apiKey: 'key_123',
      apiSecret: 'secret_456',
    });
    await hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' });

    const submit = transport.requests[0]!;
    expect(submit.headers[AUTH_HEADERS.authorization]).toBe('Key key_123:secret_456');
    expect(submit.headers['idempotency-key']).toBeTruthy();
  });

  it("accepts the combined credentials form ('id:secret')", async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, { credentials: 'kid:ksecret' });
    await hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' });
    expect(transport.requests[0]!.headers['authorization']).toBe('Key kid:ksecret');
  });

  it('create() rejects when neither credentials form is given', () => {
    expect(() => HiggsfieldClient.create({})).toThrow(TypeError);
    expect(() => HiggsfieldClient.create({ apiKey: 'only-half' })).toThrow(TypeError);
  });
});

describe('requests (jobs resource)', () => {
  it('cancels via POST /requests/{id}/cancel and reports canceled on the next poll', async () => {
    const transport = new MockTransport({ pollsToComplete: 10_000 });
    const hf = HiggsfieldClient.withTransport(transport);
    const submitted = await hf.tryon.create({
      soulId: 's',
      garmentImage: 'https://cdn.example.com/g.jpg',
    });

    await hf.jobs.cancel(submitted.request_id);
    expect(pathnameOf(transport.requests.at(-1)!.url)).toBe(
      `/requests/${submitted.request_id}/cancel`,
    );

    const status = await hf.jobs.get(submitted.request_id);
    expect(status.status).toBe('canceled'); // wire 'cancelled' → normalized
  });

  it('waitForResult on a canceled request throws JobFailedError', async () => {
    const hf = HiggsfieldClient.mock({ jobOutcome: 'canceled' });
    const submitted = await hf.tryon.create({
      soulId: 's',
      garmentImage: 'https://cdn.example.com/g.jpg',
    });
    await expect(hf.jobs.waitForResult(submitted.request_id, FAST_POLL)).rejects.toMatchObject({
      jobStatuses: ['canceled'],
    });
  });

  it('estimateRemote POSTs to /estimate/{endpoint} and parses string credits/usd', async () => {
    const transport = new MockTransport({ estimate: { credits: 12, usd: 0.12 } });
    const hf = HiggsfieldClient.withTransport(transport);

    const quote = await hf.estimateRemote(MODELS.soulImage.endpoint, { prompt: 'a coat' });
    expect(quote).toEqual({ credits: 12, usd: 0.12 });
    expect(pathnameOf(transport.requests[0]!.url)).toBe(
      `/estimate/${MODELS.soulImage.endpoint}`,
    );
    expect(transport.requests[0]!.method).toBe('POST');
  });
});

describe('images.generate', () => {
  it('submits to the Soul slug with documented defaults', async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport);
    await hf.images.generate({ prompt: 'editorial trench coat look' });

    expect(pathnameOf(transport.requests[0]!.url)).toBe('/higgsfield-ai/soul/standard');
    const body = transport.requests[0]!.body as Record<string, unknown>;
    expect(body['prompt']).toBe('editorial trench coat look');
    expect(body['aspect_ratio']).toBe('3:4');
    expect(body['num_images']).toBe(1);
  });
});

describe('retry policy', () => {
  it('retries 429 (honoring Retry-After) and 5xx, then succeeds', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 429, headers: { 'retry-after': '0' } });
    transport.queueFailure({ status: 503 });
    const hf = HiggsfieldClient.withTransport(transport);

    const submitted = await hf.tryon.create({
      soulId: 's',
      garmentImage: 'https://cdn.example.com/g.jpg',
    });
    expect(submitted.request_id).toBeTruthy();
    expect(transport.requests).toHaveLength(3); // 429, 503, then 200
  });

  it('does not retry auth failures (401)', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 401 });
    const hf = HiggsfieldClient.withTransport(transport);

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow(AuthenticationError);
    expect(transport.requests).toHaveLength(1);
  });

  it('maps 403 to InsufficientCreditsError without retrying', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 403, body: { detail: 'Not enough credits' } });
    const hf = HiggsfieldClient.withTransport(transport);

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow(InsufficientCreditsError);
    expect(transport.requests).toHaveLength(1);
  });

  it("does not retry validation failures and surfaces the API's { detail } message", async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 422, body: { detail: 'garment_image is required' } });
    const hf = HiggsfieldClient.withTransport(transport);

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow('garment_image is required');
    expect(transport.requests).toHaveLength(1);
  });

  it('retries the concurrency cap (HTTP 400 with a "concurrent" detail)', async () => {
    const transport = new MockTransport();
    transport.queueFailure({
      status: 400,
      body: { detail: 'Too many concurrent generations for this account' },
    });
    const hf = HiggsfieldClient.withTransport(transport);

    const submitted = await hf.tryon.create({
      soulId: 's',
      garmentImage: 'https://cdn.example.com/g.jpg',
    });
    expect(submitted.request_id).toBeTruthy();
    expect(transport.requests).toHaveLength(2); // 400 concurrency, then 200
  });

  it('gives up after maxRetries and throws the last error', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 500 });
    transport.queueFailure({ status: 500 });
    const hf = HiggsfieldClient.withTransport(transport, { maxRetries: 1 });

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toMatchObject({ code: 'server', status: 500 });
    expect(transport.requests).toHaveLength(2); // initial + 1 retry
  });

  it('caps an oversized Retry-After at 30s instead of honoring it verbatim', async () => {
    vi.useFakeTimers();
    try {
      const transport = new MockTransport();
      transport.queueFailure({ status: 429, headers: { 'retry-after': '3600' } });
      const hf = HiggsfieldClient.withTransport(transport);

      const pending = hf.tryon.create({
        soulId: 's',
        garmentImage: 'https://cdn.example.com/g.jpg',
      });
      // Uncapped, the retry would sleep 3_600_000ms and this advance would never release it.
      await vi.advanceTimersByTimeAsync(30_000);
      const submitted = await pending;

      expect(submitted.request_id).toBeTruthy();
      expect(transport.requests).toHaveLength(2); // 429, then 200 after the capped wait
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('request logging', () => {
  it('fires exactly one onRequest event for a terminal 422', async () => {
    const events: RequestLogEvent[] = [];
    const transport = new MockTransport();
    transport.queueFailure({ status: 422, body: { detail: 'bad payload' } });
    const hf = HiggsfieldClient.withTransport(transport, { onRequest: (e) => events.push(e) });

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow(ValidationError);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 422, attempt: 1, error: 'bad payload' });
  });

  it('fires exactly one onRequest event per attempt when retries are exhausted', async () => {
    const events: RequestLogEvent[] = [];
    const transport = new MockTransport();
    transport.queueFailure({ status: 500 });
    transport.queueFailure({ status: 500 });
    const hf = HiggsfieldClient.withTransport(transport, {
      maxRetries: 1,
      onRequest: (e) => events.push(e),
    });

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toMatchObject({ code: 'server' });

    expect(events.map((e) => [e.attempt, e.status])).toEqual([
      [1, 500],
      [2, 500],
    ]);
  });
});

describe('souls (no public Soul ID API yet)', () => {
  it('throws a clear ApiError from every method until soulsBasePath is configured', async () => {
    const hf = HiggsfieldClient.mock();
    const expectNotImplemented = (p: Promise<unknown>) =>
      expect(p).rejects.toThrow(/Soul ID API is not in the public platform docs/);

    await expectNotImplemented(hf.souls.create({ name: 'Amara', selfies: ['https://s.jpg'] }));
    await expectNotImplemented(hf.souls.get('soul_1'));
    await expectNotImplemented(hf.souls.list());
    await expectNotImplemented(hf.souls.delete('soul_1'));
    await expectNotImplemented(hf.souls.waitUntilReady('soul_1'));
    await expect(hf.souls.list()).rejects.toBeInstanceOf(ApiError);
  });

  it('routes to the custom soulsBasePath when one is provided', async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, { soulsBasePath: '/proxy/souls' });

    // The mock speaks the platform protocol only, so the proxy path 404s —
    // but the request must have been sent to the configured path.
    await expect(hf.souls.get('soul_1')).rejects.toMatchObject({ code: 'not_found' });
    expect(pathnameOf(transport.requests[0]!.url)).toBe('/proxy/souls/soul_1');
  });
});

describe('cancellation', () => {
  it('aborts polling when the caller signal fires', async () => {
    const hf = HiggsfieldClient.mock({ pollsToComplete: 10_000 });
    const controller = new AbortController();
    const pending = hf.tryon.renderAndWait(
      {
        soulId: 's',
        garmentImage: 'https://cdn.example.com/g.jpg',
        signal: controller.signal,
      },
      { ...FAST_POLL, timeoutMs: 60_000, delayMs: 50 },
    );
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toMatchObject({ code: 'aborted' });
    await expect(pending).rejects.toBeInstanceOf(AbortError);
  });
});

describe('plumbing', () => {
  it('normalizes the documented wire status aliases', () => {
    expect(normalizeStatus('in_queue')).toBe('queued');
    expect(normalizeStatus('processing')).toBe('in_progress');
    expect(normalizeStatus('cancelled')).toBe('canceled');
    expect(normalizeStatus('completed')).toBe('completed');
    expect(normalizeStatus('something_new')).toBe('unknown');
    expect(normalizeStatus(undefined)).toBe('unknown');
  });

  it('builds real platform paths (no /v1 prefix anywhere)', () => {
    expect(path(ENDPOINTS.requestStatus, { id: 'abc/1' })).toBe('/requests/abc%2F1/status');
    expect(path(ENDPOINTS.requestCancel, { id: 'r1' })).toBe('/requests/r1/cancel');
    expect(() => path(ENDPOINTS.requestStatus)).toThrow(/Missing path param/);
    expect(submitPath('higgsfield-ai/soul/standard')).toBe('/higgsfield-ai/soul/standard');
    expect(estimatePath('higgsfield-ai/dop/lite')).toBe('/estimate/higgsfield-ai/dop/lite');
  });

  it('estimates render cost per endpoint slug with a safe default', () => {
    expect(estimateCostUsd('higgsfield-ai/fashion-factory', 2)).toBeCloseTo(0.18);
    expect(estimateCostUsd('some-future-model')).toBe(0.09);
  });
});

describe('error taxonomy sanity', () => {
  it('keeps the classes distinct', () => {
    expect(new ValidationError('x')).not.toBeInstanceOf(AuthenticationError);
    expect(new InsufficientCreditsError('x')).not.toBeInstanceOf(AuthenticationError);
    expect(new InsufficientCreditsError('x').code).toBe('insufficient_credits');
  });
});
