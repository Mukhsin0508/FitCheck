/**
 * Uploads: how local images (selfies, bundled garment shots) become URLs the
 * generation endpoints can fetch. POST /uploads returns a pre-signed
 * upload_url; the bytes go there with PUT; public_url is what you pass as
 * person_image / garment_image.
 */

import { ENDPOINTS } from '../endpoints';
import { ApiError } from '../errors';
import type { HttpClient } from '../http';

export interface UploadTarget {
  public_url: string;
  upload_url: string;
  upload_headers: Record<string, string>;
}

export class UploadsResource {
  constructor(
    private readonly http: HttpClient,
    private readonly fetchFn: typeof globalThis.fetch,
  ) {}

  /** Reserve an upload slot for the given content type. */
  async createUploadUrl(
    contentType: string,
    options?: { signal?: AbortSignal },
  ): Promise<UploadTarget> {
    const payload = (await this.http.request({
      method: 'POST',
      path: ENDPOINTS.uploads,
      body: { content_type: contentType },
      signal: options?.signal,
    })) as Record<string, unknown>;

    const { public_url, upload_url } = payload ?? {};
    if (typeof public_url !== 'string' || typeof upload_url !== 'string') {
      throw new ApiError(`Unexpected upload-url response: ${JSON.stringify(payload).slice(0, 300)}`);
    }
    const headers: Record<string, string> = {};
    if (payload.upload_headers && typeof payload.upload_headers === 'object') {
      for (const [key, value] of Object.entries(payload.upload_headers as Record<string, unknown>)) {
        if (typeof value === 'string') headers[key] = value;
      }
    }
    return { public_url, upload_url, upload_headers: headers };
  }

  /**
   * One-shot helper: reserve, PUT the bytes, return the public URL.
   * `body` is whatever fetch accepts (Blob in RN/browsers, Buffer/Uint8Array in Node).
   */
  async uploadBytes(
    body: Blob | ArrayBuffer | Uint8Array,
    contentType: string,
    options?: { signal?: AbortSignal },
  ): Promise<string> {
    const target = await this.createUploadUrl(contentType, options);
    const response = await this.fetchFn(target.upload_url, {
      method: 'PUT',
      headers: { 'content-type': contentType, ...target.upload_headers },
      // BodyInit isn't in this package's ES2022 lib; the runtime accepts all three forms.
      body: body as never,
      signal: options?.signal ?? null,
    });
    if (!response.ok) {
      throw new ApiError(`Upload PUT failed with HTTP ${response.status}`, {
        status: response.status,
      });
    }
    return target.public_url;
  }
}
