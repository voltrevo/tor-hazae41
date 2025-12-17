export class Future<T> {

  #resolve: (value: T) => void

  #reject: (error: unknown) => void

  readonly promise: Promise<T>

  /**
   * Just a Promise with a resolve and reject function
   */
  constructor(promise?: Promise<T>) {
    if (promise == null) {
      const { promise, resolve, reject } = Promise.withResolvers<T>()

      this.promise = promise
      this.#resolve = resolve
      this.#reject = reject
    } else {
      this.promise = promise
      this.#resolve = () => { }
      this.#reject = () => { }
    }
  }

  static resolve(): Future<void>

  static resolve<T>(value: T): Future<Awaited<T>>

  static resolve<T>(value: T | PromiseLike<T>): Future<Awaited<T>>

  static resolve(value?: any) {
    return new Future(Promise.resolve(value))
  }

  static reject<T = never>(reason?: any): Future<T> {
    return new Future<T>(Promise.reject<T>(reason))
  }

  get resolve() {
    return this.#resolve
  }

  get reject() {
    return this.#reject
  }

}
