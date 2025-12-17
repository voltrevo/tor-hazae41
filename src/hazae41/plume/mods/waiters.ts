import { Signals } from "../../signals/index.ts"
import { CloseEvents, rejectOnClose } from "./closed"
import { ErrorEvents, rejectOnError } from "./errored"
import { SuperEventMap, SuperEventTarget, SuperEventWaiter } from "./target"

export async function waitOrThrow<M extends SuperEventMap, K extends keyof M, R>(target: SuperEventTarget<M>, type: K, callback: SuperEventWaiter<M[K], R>, signal = new AbortController().signal): Promise<R> {
  using abort = Signals.rejectOnAbort(signal)
  using event = target.wait(type, callback)

  return await Promise.race([abort.get(), event.get()])
}

export async function waitWithCloseAndErrorOrThrow<M extends SuperEventMap & CloseEvents & ErrorEvents, K extends keyof M, R>(target: SuperEventTarget<M>, type: K, callback: SuperEventWaiter<M[K], R>, signal = new AbortController().signal): Promise<R> {
  using abort = Signals.rejectOnAbort(signal)
  using error = rejectOnError(target)
  using close = rejectOnClose(target)
  using event = target.wait(type, callback)

  return await Promise.race([abort.get(), error.get(), close.get(), event.get()])
}