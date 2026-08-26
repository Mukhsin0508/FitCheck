/**
 * Try-on through the FitCheck render proxy — the web embed's path to real,
 * personalized renders. The proxy (apps/landing/app/api/tryon/route.ts) holds
 * the Higgsfield key server-side and enforces a per-visitor spend cap; this
 * provider just posts the person photo + garment URL and polls for the image.
 *
 * Active only on web when EXPO_PUBLIC_TRYON_PROXY is set at export time, and
 * only renders people who onboarded with their own photos (data URLs) — the
 * demo avatar keeps its instant pre-rendered fits.
 */

import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '@fitcheck/tryon';
import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import { catalogImages, demoImages } from '@/lib/images';

const ASSET_PREFIX = 'asset://';
const POLL_MS = 2_500;
const TIMEOUT_MS = 120_000;

export function tryOnProxyPath(): string | undefined {
  if (Platform.OS !== 'web') return undefined;
  const value = process.env.EXPO_PUBLIC_TRYON_PROXY;
  return value && value.startsWith('/') ? value : undefined;
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(), ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new Error('aborted'));
      },
      { once: true },
    );
  });
}

/** asset://key → the exported bundle URL, absolute so the API can fetch it. */
function resolveGarmentUrl(ref: string): string {
  if (/^https?:\/\//i.test(ref)) return ref;
  if (!ref.startsWith(ASSET_PREFIX)) throw new Error(`Garment ref is not fetchable: ${ref}`);
  const key = ref.slice(ASSET_PREFIX.length);
  const moduleRef = demoImages[key] ?? catalogImages[key];
  if (!moduleRef) throw new Error(`Unknown bundled asset: ${key}`);
  const uri = Asset.fromModule(moduleRef as number).uri;
  if (/^https?:\/\//i.test(uri)) return uri;
  if (typeof location === 'undefined') throw new Error('No origin to absolutize against');
  return new URL(uri, location.origin).toString();
}

export class ProxyTryOnProvider implements TryOnProvider {
  readonly name = 'higgsfield' as const;
  readonly costPerRenderUsd = 0.09;

  constructor(private readonly path: string) {}

  supports(_category: GarmentCategory): boolean {
    return true;
  }

  async render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput> {
    const person = request.person.imageUrl;
    if (!person || !person.startsWith('data:image/')) {
      // Demo avatar or missing photo — let the mock provider take it.
      throw new Error('proxy renders need the visitor’s own photo');
    }
    const garment = resolveGarmentUrl(request.garment.imageUrl);
    const startedAt = Date.now();

    const submit = await fetch(this.path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ person, garment, category: request.garment.category }),
      signal: options?.signal,
    });
    if (submit.status === 429) {
      throw new Error('render budget for this connection is used up for now');
    }
    if (!submit.ok) throw new Error(`proxy submit failed: HTTP ${submit.status}`);
    const { id } = (await submit.json()) as { id?: string };
    if (!id) throw new Error('proxy submit returned no request id');

    while (Date.now() - startedAt < TIMEOUT_MS) {
      await delay(POLL_MS, options?.signal);
      const res = await fetch(`${this.path}?id=${encodeURIComponent(id)}`, {
        signal: options?.signal,
      });
      if (!res.ok) continue; // transient status hiccup — poll again
      const body = (await res.json()) as {
        status?: string;
        images?: { url?: string; preview_url?: string }[];
      };
      if (body.status === 'completed') {
        const image = body.images?.[0];
        if (!image?.url) throw new Error('render completed without an image');
        return {
          imageUrl: image.url,
          previewUrl: image.preview_url,
          durationMs: Date.now() - startedAt,
        };
      }
      if (body.status === 'failed' || body.status === 'nsfw' || body.status === 'canceled') {
        throw new Error(`render ${body.status}`);
      }
    }
    throw new Error('render timed out');
  }
}
