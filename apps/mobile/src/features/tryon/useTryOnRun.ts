/**
 * Runs one try-on render per (productId, url, attempt) and reports its phase.
 *
 * 'rendering'  → request in flight (~5s in demo mode)
 * 'finishing'  → render resolved; short hold so the progress bar lands on 100%
 * 'done'       → show the fit
 * 'error'      → something slipped; retry() re-runs with a fresh attempt key
 */

import type { TryOnRender } from '@fitcheck/tryon';
import { useCallback, useEffect, useRef, useState } from 'react';

import { requestForPastedUrl, requestForProduct, tryOnService } from '@/lib/tryon';

export type TryOnRunStatus = 'rendering' | 'finishing' | 'done' | 'error';

export interface TryOnRun {
  status: TryOnRunStatus;
  render?: TryOnRender;
  retry: () => void;
}

/** Short hold after the render resolves so the bar visibly hits 100%. */
const FINISH_HOLD_MS = 380;

/** Cancellation surfaces as DOMException 'AbortError' or a provider error with code 'aborted'. */
function isAbortRejection(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return name === 'AbortError' || code === 'aborted';
}

export function useTryOnRun(productId: string, pastedUrl?: string): TryOnRun {
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<TryOnRunStatus>('rendering');
  const [render, setRender] = useState<TryOnRender | undefined>(undefined);

  // Cancelled-flag equivalent: a run only applies its result while its key is
  // still the latest one. Also guards StrictMode's double effect invocation —
  // the same key never kicks off a second render.
  const runKeyRef = useRef('');

  useEffect(() => {
    const key = `${productId}|${pastedUrl ?? ''}|${attempt}`;
    if (runKeyRef.current === key) return;
    runKeyRef.current = key;
    const isCurrent = () => runKeyRef.current === key;

    setStatus('rendering');
    setRender(undefined);

    let request;
    try {
      request =
        productId === 'pasted'
          ? requestForPastedUrl(String(pastedUrl ?? ''))
          : requestForProduct(productId);
    } catch {
      setStatus('error');
      return;
    }

    const controller = new AbortController();

    tryOnService
      .tryOn(request, { signal: controller.signal })
      .then((result) => {
        if (!isCurrent()) return;
        setRender(result);
        setStatus('finishing');
        setTimeout(() => {
          if (isCurrent()) setStatus('done');
        }, FINISH_HOLD_MS);
      })
      .catch((error: unknown) => {
        // An aborted run was cancelled on purpose — never surface it as an error.
        if (controller.signal.aborted || isAbortRejection(error)) return;
        if (isCurrent()) setStatus('error');
      });

    return () => {
      // Clear the key so a remount (incl. StrictMode's re-invocation) restarts
      // the run, and so late settlements fail the isCurrent() check above.
      if (runKeyRef.current === key) runKeyRef.current = '';
      controller.abort();
    };
  }, [productId, pastedUrl, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { status, render, retry };
}
