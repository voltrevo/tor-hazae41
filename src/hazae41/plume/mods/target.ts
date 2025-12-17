import { Future } from '../../future/index.ts';
import { None, Option, Some } from '../../option/index.ts';
import { WeakParameters } from '../libs/parameters/index.ts';
import { Awaitable } from '../libs/promises/index.ts';
import { Voidable } from '../libs/voidable/index.ts';

export type SuperEventDescriptor = (...args: any) => any;

export type SuperEventMap = Record<string, SuperEventDescriptor>;

export type SuperEventListener<T extends SuperEventDescriptor> = (
  ...params: WeakParameters<T>
) => Awaitable<Voidable<Option<ReturnType<T>>>>;

export type SuperEventWaiter<T extends SuperEventDescriptor, R> = (
  future: Future<R>,
  ...params: WeakParameters<T>
) => Awaitable<Voidable<Option<ReturnType<T>>>>;

export class SuperEventTarget<M extends SuperEventMap> {
  readonly #listeners = new Map<
    keyof M,
    Map<SuperEventListener<any>, AddEventListenerOptions & Disposable>
  >();

  get listeners() {
    return this.#listeners;
  }

  /**
   * Add a listener to an event
   * @param type Event type //  "abort", "error", "message", "close"
   * @param listener Event listener // (e) => new Some(123)
   * @param options Options // { passive: true }
   * @returns
   */
  on<K extends keyof M>(
    type: K,
    listener: SuperEventListener<M[K]>,
    options: AddEventListenerOptions = {}
  ) {
    let listeners = this.#listeners.get(type);

    if (listeners === undefined) {
      listeners = new Map<
        SuperEventListener<any>,
        AddEventListenerOptions & Disposable
      >();
      this.#listeners.set(type, listeners);
    }

    const off = () => this.off(type, listener);

    options.signal?.addEventListener('abort', off, { passive: true });
    const dispose = () => options.signal?.removeEventListener('abort', off);

    listeners.set(listener, { ...options, [Symbol.dispose]: () => dispose() });

    return off;
  }

  /**
   * Remove a listener from an event
   * @param type Event type //  "abort", "error", "message", "close"
   * @param listener Event listener // (e) => console.log("hello")
   * @param options Just to look like DOM's EventTarget
   * @returns
   */
  off<K extends keyof M>(type: K, listener: SuperEventListener<M[K]>) {
    const listeners = this.#listeners.get(type);

    if (!listeners) return;

    using options = listeners.get(listener);

    if (!options) return;

    listeners.delete(listener);

    if (listeners.size > 0) return;

    this.#listeners.delete(type);
  }

  /**
   * Dispatch an event to its listeners
   *
   * - Dispatch to active listeners sequencially
   * - Return if one of the listeners returned something
   * - Dispatch to passive listeners concurrently
   * - Return if one of the listeners returned something
   * - Return nothing
   * @param params The object to emit
   * @returns `Some` if the event
   */
  async emit<K extends keyof M>(
    type: K,
    ...params: WeakParameters<M[K]>
  ): Promise<Option<ReturnType<M[K]>>> {
    const listeners = this.#listeners.get(type) as
      | Map<SuperEventListener<M[K]>, AddEventListenerOptions & Disposable>
      | undefined;

    if (!listeners) return new None();

    const promises = new Array<Promise<Voidable<Option<ReturnType<M[K]>>>>>();

    for (const [listener, options] of listeners) {
      if (options.passive) continue;
      if (options.once) this.off(type, listener);

      const returned = await listener(...params);

      if (returned == null) continue;
      if (returned.isNone()) continue;

      return new Some(returned.get());
    }

    for (const [listener, options] of listeners) {
      if (!options.passive) continue;
      if (options.once) this.off(type, listener);

      const promise = Promise.resolve().then(() => listener(...params));

      promises.push(promise);

      continue;
    }

    const returneds = await Promise.all(promises);

    for (const returned of returneds) {
      if (returned == null) continue;
      if (returned.isNone()) continue;

      return new Some(returned.get());
    }

    return new None();
  }

  /**
   * Like `.on`, but instead of returning to the target, capture the returned value in a future, and return nothing to the target
   * @param type
   * @param callback
   * @returns
   */
  wait<K extends keyof M, R>(type: K, callback: SuperEventWaiter<M[K], R>) {
    const future = new Future<R>();

    const dispose = this.on(
      type,
      async (...params: WeakParameters<M[K]>) => {
        return await callback(future, ...params);
      },
      { passive: true }
    );

    return Object.assign(future.promise, { dispose }) as any;
  }
}
