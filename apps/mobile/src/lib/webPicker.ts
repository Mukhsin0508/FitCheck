/**
 * Web-only photo picker. expo-image-picker's web path drives a detached input
 * with a synthetic click and hands back blob: URLs that die on reload; this
 * one clicks a real DOM input directly inside the user's gesture and returns
 * downscaled JPEG data URLs that persist in localStorage and can be posted to
 * the try-on proxy.
 */

import { Platform } from 'react-native';

/** Long edge of the stored photo — plenty for try-on, small enough to persist. */
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.85;

export function webPickerAvailable(): boolean {
  return Platform.OS === 'web' && typeof document !== 'undefined';
}

function drawToDataUrl(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.scale(scale, scale);
  draw(ctx);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/** Decode + downscale one picked file. Throws on undecodable input (e.g. HEIC). */
async function fileToDataUrl(file: File): Promise<string> {
  if (typeof createImageBitmap === 'function') {
    try {
      // from-image applies the EXIF orientation, so portraits stay upright.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      try {
        return drawToDataUrl(bitmap.width, bitmap.height, (ctx) => ctx.drawImage(bitmap, 0, 0));
      } finally {
        bitmap.close();
      }
    } catch {
      // Fall through to the <img> decoder below.
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`could not decode ${file.name}`));
      img.src = url;
    });
    return drawToDataUrl(image.naturalWidth, image.naturalHeight, (ctx) =>
      ctx.drawImage(image, 0, 0),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Open the browser's file dialog and resolve with data URLs. Resolves []
 * on cancel and skips files the browser can't decode; never rejects and
 * never leaves the page in a stuck state.
 */
export function pickImagesWeb(max: number): Promise<string[]> {
  if (!webPickerAvailable() || max < 1) return Promise.resolve([]);
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = max > 1;
    // Present but invisible: some browsers ignore clicks on display:none inputs.
    input.style.position = 'fixed';
    input.style.left = '-10000px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.style.opacity = '0';
    document.body.appendChild(input);

    let settled = false;
    const settle = async () => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onRefocus);
      const files = Array.from(input.files ?? []).slice(0, max);
      input.remove();
      const uris: string[] = [];
      for (const file of files) {
        try {
          uris.push(await fileToDataUrl(file));
        } catch {
          // Undecodable file (HEIC in some browsers) — skip it, keep the rest.
        }
      }
      resolve(uris);
    };

    // Safety net for browsers that fire neither event on a dismissed dialog:
    // when focus returns with no files after a beat, treat it as a cancel.
    const onRefocus = () => {
      setTimeout(() => {
        if (!settled && (input.files?.length ?? 0) === 0) void settle();
      }, 600);
    };

    input.addEventListener('change', () => void settle(), { once: true });
    input.addEventListener('cancel', () => void settle(), { once: true });
    window.addEventListener('focus', onRefocus, { once: true });

    input.click();
  });
}
