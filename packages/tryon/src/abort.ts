/**
 * Hermes-safe AbortSignal helpers. React Native's AbortSignal lacks
 * `throwIfAborted` (and `AbortSignal.timeout/any`), so providers must not
 * call instance methods newer than `aborted` + add/removeEventListener.
 */

export function abortError(): Error {
  return Object.assign(new Error('Aborted'), { name: 'AbortError', code: 'aborted' });
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

/** setTimeout that rejects with an AbortError-shaped error when the signal fires. */
export function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
