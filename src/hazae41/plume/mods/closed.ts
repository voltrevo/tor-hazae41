import { SuperEventTarget } from './target';

export type CloseEvents = {
  close: (reason?: unknown) => void;
};

export function rejectOnClose<M extends CloseEvents>(
  target: SuperEventTarget<M>
) {
  return target.wait(
    'close',
    (future: PromiseWithResolvers<never>, ...[cause]) =>
      future.reject(new Error('Closed', { cause }))
  );
}
