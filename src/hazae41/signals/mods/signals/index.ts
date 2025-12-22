import { Pin } from '../../../box';
import { Future } from '../../../future';

export class AbortError extends Error {
  constructor(readonly signal: AbortSignal) {
    super('Aborted', { cause: signal.reason });
  }
}

export function resolveOnAbort(signal: AbortSignal) {
  if (signal.aborted) return Pin.with(Promise.resolve(signal.reason), () => {});

  const resolveOnAbort = new Future<unknown>();

  const onAbort = () => resolveOnAbort.resolve(signal.reason);
  const onClean = () => signal.removeEventListener('abort', onAbort);

  signal.addEventListener('abort', onAbort, { passive: true });

  resolveOnAbort.promise.then(onClean);

  return Pin.with(resolveOnAbort.promise, onClean);
}

export function rejectOnAbort(signal: AbortSignal) {
  if (signal.aborted)
    return Pin.with(Promise.reject(new AbortError(signal)), () => {});

  const rejectOnAbort = new Future<never>();

  const onAbort = () => rejectOnAbort.reject(new AbortError(signal));
  const onClean = () => signal.removeEventListener('abort', onAbort);

  signal.addEventListener('abort', onAbort, { passive: true });

  rejectOnAbort.promise.catch(onClean);

  return Pin.with(rejectOnAbort.promise, onClean);
}
