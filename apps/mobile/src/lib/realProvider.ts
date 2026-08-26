/**
 * Real Higgsfield try-on provider for dev builds.
 *
 * Active only when EXPO_PUBLIC_HIGGSFIELD_CREDENTIALS is set in .env. Local
 * images (your selfie, bundled garment shots) are uploaded through
 * POST /uploads first, so the generation endpoint gets real URLs. Every
 * failure falls through to the mock provider — the demo never breaks.
 *
 * ⚠️ Dev-only wiring: EXPO_PUBLIC_ env vars ship inside the JS bundle.
 * Production must route through a FitCheck server that holds the key.
 */

import { HiggsfieldClient } from '@fitcheck/higgsfield';
import type {
  GarmentCategory,
  ProviderRenderOutput,
  TryOnProvider,
  TryOnRequest,
} from '@fitcheck/tryon';
import { Asset } from 'expo-asset';
// Legacy namespace: uploadAsync does a native binary PUT — RN's fetch+Blob
// mangles pre-signed S3 uploads (403 SignatureDoesNotMatch).
import * as FileSystem from 'expo-file-system/legacy';

import { catalogImages, demoImages } from '@/lib/images';

const ASSET_PREFIX = 'asset://';

export function higgsfieldCredentials(): string | undefined {
  const value = process.env.EXPO_PUBLIC_HIGGSFIELD_CREDENTIALS;
  return value && value.includes(':') ? value : undefined;
}

function createClient(credentials: string): HiggsfieldClient {
  return HiggsfieldClient.create({
    credentials,
    baseUrl: process.env.EXPO_PUBLIC_HIGGSFIELD_BASE_URL || undefined,
    tryOnEndpoint: process.env.EXPO_PUBLIC_HIGGSFIELD_TRYON_ENDPOINT || undefined,
  });
}

export class RealHiggsfieldProvider implements TryOnProvider {
  readonly name = 'higgsfield' as const;
  readonly costPerRenderUsd = 0.09;

  private readonly client: HiggsfieldClient;
  /** Local ref → uploaded public URL, so a session never uploads twice. */
  private readonly uploaded = new Map<string, string>();

  constructor(credentials: string) {
    this.client = createClient(credentials);
  }

  supports(_category: GarmentCategory): boolean {
    return true;
  }

  async render(
    request: TryOnRequest,
    options?: { signal?: AbortSignal },
  ): Promise<ProviderRenderOutput> {
    try {
      const personUrl = request.person.imageUrl
        ? await this.ensureRemoteUrl(request.person.imageUrl, options?.signal)
        : undefined;
      const garmentUrl = await this.ensureRemoteUrl(request.garment.imageUrl, options?.signal);

      // The moderation filter occasionally false-flags innocent renders;
      // one retry of the identical request usually passes.
      let lastError: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await this.client.tryon.renderAndWait(
            {
              soulId: request.person.soulId,
              personImage: personUrl,
              garmentImage: garmentUrl,
              category: request.garment.category,
              signal: options?.signal,
            },
            { timeoutMs: 120_000 },
          );
          const image = result.images[0];
          if (!image) throw new Error('Render completed without an image');
          return { imageUrl: image.url, previewUrl: image.previewUrl, durationMs: result.durationMs };
        } catch (error) {
          lastError = error;
          const isNsfw =
            !!error && typeof error === 'object' && 'jobStatuses' in error &&
            Array.isArray((error as { jobStatuses?: unknown }).jobStatuses) &&
            ((error as { jobStatuses: string[] }).jobStatuses).includes('nsfw');
          if (!isNsfw || attempt > 0) throw error;
          console.warn('[fitcheck] moderation false-flag suspected; retrying render once');
        }
      }
      throw lastError;
    } catch (error) {
      // Surface why real mode fell back — visible in the Metro logs.
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[fitcheck] real render failed (${message}); falling back to demo render`);
      throw error;
    }
  }

  /** http(s) URLs pass through; asset:// and file:// refs upload once per session. */
  private async ensureRemoteUrl(ref: string, signal?: AbortSignal): Promise<string> {
    if (/^https?:\/\//i.test(ref)) return ref;
    const cached = this.uploaded.get(ref);
    if (cached) return cached;

    const localUri = await this.resolveLocalUri(ref);
    const contentType = /\.png$/i.test(localUri) ? 'image/png' : 'image/jpeg';

    const target = await this.client.uploads.createUploadUrl(contentType, { signal });
    const result = await FileSystem.uploadAsync(target.upload_url, localUri, {
      httpMethod: 'PUT',
      headers: target.upload_headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Upload PUT failed with HTTP ${result.status}`);
    }

    this.uploaded.set(ref, target.public_url);
    return target.public_url;
  }

  private async resolveLocalUri(ref: string): Promise<string> {
    if (!ref.startsWith(ASSET_PREFIX)) return ref; // file:// and friends
    const key = ref.slice(ASSET_PREFIX.length);
    const moduleRef = demoImages[key] ?? catalogImages[key];
    if (!moduleRef) throw new Error(`Unknown bundled asset: ${key}`);
    const asset = Asset.fromModule(moduleRef as number);
    await asset.downloadAsync();
    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error(`Could not resolve a local uri for asset: ${key}`);
    return uri;
  }
}
