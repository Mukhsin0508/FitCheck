import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  HiggsfieldClient,
  JobFailedError,
  MockTransport,
  PollTimeoutError,
  ValidationError,
  estimateCostUsd,
  normalizeStatus,
  type UsageEvent,
} from '../src';
import { path, ENDPOINTS, AUTH_HEADERS } from '../src/endpoints';

const FAST_POLL = { initialDelayMs: 0, delayMs: 1, maxDelayMs: 2 };

describe('tryon.renderAndWait', () => {
  it('submits, polls to completion, and returns the rendered image', async () => {
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

    // Spend accounting fired once with the soul-outfit estimate.
    expect(usage).toHaveLength(1);
    expect(usage[0]!.operation).toBe('tryon');
    expect(usage[0]!.estimatedCostUsd).toBe(estimateCostUsd('soul-outfit', 1));
  });

  it('requires a person: soulId or personImage', async () => {
    const hf = HiggsfieldClient.mock();
    await expect(
      hf.tryon.create({ garmentImage: 'https://cdn.example.com/dress.jpg' }),
    ).rejects.toThrow(TypeError);
  });

  it('surfaces nsfw/failed job sets as JobFailedError', async () => {
    const hf = HiggsfieldClient.mock({ jobOutcome: 'nsfw' });
    await expect(
      hf.tryon.renderAndWait(
        { soulId: 'soul_demo', garmentImage: 'https://cdn.example.com/top.jpg' },
        FAST_POLL,
      ),
    ).rejects.toThrow(JobFailedError);
  });

  it('times out when the job set never finishes', async () => {
    const hf = HiggsfieldClient.mock({ pollsToComplete: 10_000 });
    await expect(
      hf.tryon.renderAndWait(
        { soulId: 'soul_demo', garmentImage: 'https://cdn.example.com/top.jpg' },
        { ...FAST_POLL, timeoutMs: 25 },
      ),
    ).rejects.toThrow(PollTimeoutError);
  });

  it('sends auth headers and an idempotency key on job-creating POSTs', async () => {
    const transport = new MockTransport();
    const hf = HiggsfieldClient.withTransport(transport, {
      apiKey: 'key_123',
      apiSecret: 'secret_456',
    });
    await hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' });

    const submit = transport.requests[0]!;
    expect(submit.headers[AUTH_HEADERS.apiKey]).toBe('key_123');
    expect(submit.headers[AUTH_HEADERS.apiSecret]).toBe('secret_456');
    expect(submit.headers['idempotency-key']).toBeTruthy();
  });
});

describe('retry policy', () => {
  it('retries 429 (honoring Retry-After) and 5xx, then succeeds', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 429, headers: { 'retry-after': '0' } });
    transport.queueFailure({ status: 503 });
    const hf = HiggsfieldClient.withTransport(transport);

    const jobSet = await hf.tryon.create({
      soulId: 's',
      garmentImage: 'https://cdn.example.com/g.jpg',
    });
    expect(jobSet.id).toBeTruthy();
    expect(transport.requests).toHaveLength(3); // 429, 503, then 200
  });

  it('does not retry auth failures', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 401 });
    const hf = HiggsfieldClient.withTransport(transport);

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow(AuthenticationError);
    expect(transport.requests).toHaveLength(1);
  });

  it('does not retry validation failures and surfaces the API message', async () => {
    const transport = new MockTransport();
    transport.queueFailure({ status: 422, body: { message: 'garment_image is required' } });
    const hf = HiggsfieldClient.withTransport(transport);

    await expect(
      hf.tryon.create({ soulId: 's', garmentImage: 'https://cdn.example.com/g.jpg' }),
    ).rejects.toThrow('garment_image is required');
    expect(transport.requests).toHaveLength(1);
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
});

describe('souls', () => {
  it('creates an avatar and waits until it is ready', async () => {
    const hf = HiggsfieldClient.mock({ pollsToComplete: 2 });
    const soul = await hf.souls.create({
      name: 'Amara',
      selfies: ['https://cdn.example.com/s1.jpg', 'https://cdn.example.com/s2.jpg'],
      fullBody: 'https://cdn.example.com/fb.jpg',
    });
    expect(soul.status).toBe('in_progress');

    const ready = await hf.souls.waitUntilReady(soul.id, { ...FAST_POLL, timeoutMs: 5_000 });
    expect(ready.status).toBe('completed');

    const listed = await hf.souls.list();
    expect(listed.map((s) => s.id)).toContain(soul.id);

    await hf.souls.delete(soul.id);
    const afterDelete = await hf.souls.list();
    expect(afterDelete.map((s) => s.id)).not.toContain(soul.id);
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
  });
});

describe('plumbing', () => {
  it('normalizes API status aliases', () => {
    expect(normalizeStatus('pending')).toBe('queued');
    expect(normalizeStatus('processing')).toBe('in_progress');
    expect(normalizeStatus('succeeded')).toBe('completed');
    expect(normalizeStatus('cancelled')).toBe('canceled');
    expect(normalizeStatus('something_new')).toBe('unknown');
    expect(normalizeStatus(undefined)).toBe('unknown');
  });

  it('fills path templates and rejects missing params', () => {
    expect(path(ENDPOINTS.jobSetGet, { id: 'abc/1' })).toBe('/v1/job-sets/abc%2F1');
    expect(() => path(ENDPOINTS.jobSetGet)).toThrow(/Missing path param/);
  });

  it('estimates render cost per model with a safe default', () => {
    expect(estimateCostUsd('soul-outfit', 2)).toBeCloseTo(0.18);
    expect(estimateCostUsd('some-future-model')).toBe(0.09);
  });
});

describe('ValidationError export sanity', () => {
  it('is distinct from AuthenticationError', () => {
    expect(new ValidationError('x')).not.toBeInstanceOf(AuthenticationError);
  });
});
