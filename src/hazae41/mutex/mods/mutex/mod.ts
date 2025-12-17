import type { Awaitable } from "../../libs/awaitable/mod.ts"
import type { Nullable } from "../../libs/nullable/mod.ts"

export class LockedError extends Error {
  readonly #class = LockedError

  override readonly name: string = this.#class.name

  constructor() {
    super("Locked")
  }

}

export class Lock<T> {

  constructor(
    readonly value: T,
    readonly clean: () => void
  ) { }

  [Symbol.dispose]() {
    this.clean()
  }

  // deno-lint-ignore require-await
  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]()
  }

  get(): T {
    return this.value
  }

}

/**
 * A limited counter
 */
export class Semaphore<T, N extends number = number> {

  #queue = new Array<PromiseWithResolvers<void>>()

  #count = 0

  constructor(
    readonly value: T,
    readonly limit: N
  ) { }

  [Symbol.dispose](this: Semaphore<Disposable, N>) {
    this.value[Symbol.dispose]()
  }

  async [Symbol.asyncDispose](this: Semaphore<AsyncDisposable, N>) {
    await this.value[Symbol.asyncDispose]()
  }

  get count(): number {
    return this.#count
  }

  get locked(): boolean {
    return this.#count >= this.limit
  }

  #unlock() {
    this.#count--

    this.#queue.shift()?.resolve()

    return
  }

  get(): T {
    return this.value
  }

  getOrNull(): Nullable<T> {
    if (this.#count >= this.limit)
      return
    return this.value
  }

  getOrThrow(): T {
    if (this.#count >= this.limit)
      throw new LockedError()
    return this.value
  }

  async wait() {
    this.#count++

    if (this.#count > this.limit) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    this.#unlock()
  }

  lockOrNull(): Nullable<Lock<T>> {
    if (this.#count >= this.limit)
      return

    this.#count++

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * Get and lock or throw
   * @returns 
   */
  lockOrThrow(): Lock<T> {
    if (this.#count >= this.limit)
      throw new LockedError()

    this.#count++

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * Get and lock or wait
   * @returns 
   */
  async lockOrWait(): Promise<Lock<T>> {
    this.#count++

    if (this.#count > this.limit) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * @deprecated
   * @param callback 
   * @returns 
   */
  async runOrThrow<R>(callback: (value: T) => Awaitable<R>): Promise<R> {
    if (this.#count >= this.limit)
      throw new LockedError()

    this.#count++

    try {
      return await callback(this.value)
    } finally {
      this.#unlock()
    }
  }

  /**
   * @deprecated
   * @param callback 
   * @returns 
   */
  async runOrWait<R>(callback: (value: T) => Awaitable<R>): Promise<R> {
    this.#count++

    if (this.#count > this.limit) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    try {
      return await callback(this.value)
    } finally {
      this.#unlock()
    }
  }

}

/**
 * A semaphore but with a limit of 1
 */
export class Mutex<T> {

  #queue = new Array<PromiseWithResolvers<void>>()

  #count = 0

  constructor(
    readonly value: T
  ) { }

  [Symbol.dispose](this: Mutex<Disposable>) {
    this.value[Symbol.dispose]()
  }

  async [Symbol.asyncDispose](this: Mutex<AsyncDisposable>) {
    await this.value[Symbol.asyncDispose]()
  }

  get count(): number {
    return this.#count
  }

  get locked(): boolean {
    return this.#count >= 1
  }

  #unlock() {
    this.#count--

    this.#queue.shift()?.resolve()

    return
  }

  get(): T {
    return this.value
  }

  getOrNull(): Nullable<T> {
    if (this.#count >= 1)
      return
    return this.value
  }

  getOrThrow(): T {
    if (this.#count >= 1)
      throw new LockedError()
    return this.value
  }

  async wait() {
    this.#count++

    if (this.#count > 1) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    this.#unlock()
  }

  lockOrNull(): Nullable<Lock<T>> {
    if (this.#count >= 1)
      return

    this.#count++

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * Get and lock or throw
   * @returns 
   */
  lockOrThrow(): Lock<T> {
    if (this.#count >= 1)
      throw new LockedError()

    this.#count++

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * Get and lock or wait
   * @returns 
   */
  async lockOrWait(): Promise<Lock<T>> {
    this.#count++

    if (this.#count > 1) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    return new Lock(this.value, () => this.#unlock())
  }

  /**
   * @deprecated
   * @param callback 
   * @returns 
   */
  async runOrThrow<R>(callback: (value: T) => Awaitable<R>): Promise<R> {
    if (this.#count >= 1)
      throw new LockedError()

    this.#count++

    try {
      return await callback(this.value)
    } finally {
      this.#unlock()
    }
  }

  /**
   * @deprecated
   * @param callback 
   * @returns 
   */
  async runOrWait<R>(callback: (value: T) => Awaitable<R>): Promise<R> {
    this.#count++

    if (this.#count > 1) {
      const future = Promise.withResolvers<void>()
      this.#queue.push(future)
      await future.promise
    }

    try {
      return await callback(this.value)
    } finally {
      this.#unlock()
    }
  }

}