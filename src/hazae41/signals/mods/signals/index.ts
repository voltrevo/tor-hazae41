import { Future } from '../../../future/index';

export class AbortError extends Error {
  constructor(readonly signal: AbortSignal) {
    super('Aborted', { cause: signal.reason });
  }
}

export function resolveOnAbort(signal: AbortSignal) {
  if (signal.aborted) return Promise.resolve(signal.reason);

  const resolveOnAbort = new Future<unknown>();

  const onAbort = () => resolveOnAbort.resolve(signal.reason);
  const onClean = () => signal.removeEventListener('abort', onAbort);

  signal.addEventListener('abort', onAbort, { passive: true });

  resolveOnAbort.promise.finally(onClean);

  return resolveOnAbort.promise;
}

export function rejectOnAbort(signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new AbortError(signal));

  const rejectOnAbort = new Future<never>();

  const onAbort = () => rejectOnAbort.reject(new AbortError(signal));
  const onClean = () => signal.removeEventListener('abort', onAbort);

  signal.addEventListener('abort', onAbort, { passive: true });

  rejectOnAbort.promise.finally(onClean);

  return rejectOnAbort.promise;
}
