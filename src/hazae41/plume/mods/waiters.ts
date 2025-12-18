import { Signals } from '../../signals/index';
import { CloseEvents, rejectOnClose } from './closed';
import { ErrorEvents, rejectOnError } from './errored';
import { SuperEventMap, SuperEventTarget, SuperEventWaiter } from './target';

export async function waitOrThrow<
  M extends SuperEventMap,
  K extends keyof M,
  R,
>(
  target: SuperEventTarget<M>,
  type: K,
  callback: SuperEventWaiter<M[K], R>,
  signal = new AbortController().signal
): Promise<R> {
  const abort = Signals.rejectOnAbort(signal);
  using event = target.wait(type, callback);

  return await Promise.race([abort, event.get()]);
}

export async function waitWithCloseAndErrorOrThrow<
  M extends SuperEventMap & CloseEvents & ErrorEvents,
  K extends keyof M,
  R,
>(
  target: SuperEventTarget<M>,
  type: K,
  callback: SuperEventWaiter<M[K], R>,
  signal = new AbortController().signal
): Promise<R> {
  const abort = Signals.rejectOnAbort(signal);
  using error = rejectOnError(target);
  using close = rejectOnClose(target);
  using event = target.wait(type, callback);

  return await Promise.race([abort, error.get(), close.get(), event.get()]);
}
