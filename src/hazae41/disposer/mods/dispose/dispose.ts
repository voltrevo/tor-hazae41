export class Disposer<T> implements Disposable {

  constructor(
    readonly inner: T,
    readonly clean: (inner: T) => void
  ) { }

  static from<T>(disposable: T & Disposable) {
    return new Disposer(disposable, () => disposable[Symbol.dispose]())
  }

  [Symbol.dispose]() {
    this.dispose()
  }

  dispose() {
    this.clean(this.inner)
  }

  get() {
    return this.inner
  }

  async await<T>(this: Disposer<Promise<T>>) {
    try {
      return await this.get()
    } finally {
      this.dispose()
    }
  }

}

export class AsyncDisposer<T> implements AsyncDisposable {

  constructor(
    readonly inner: T,
    readonly clean: (inner: T) => PromiseLike<void>
  ) { }

  static from<T>(disposable: T & AsyncDisposable) {
    return new AsyncDisposer(disposable, () => disposable[Symbol.asyncDispose]())
  }

  async [Symbol.asyncDispose]() {
    await this.dispose()
  }

  async dispose() {
    await this.clean(this.inner)
  }

  get() {
    return this.inner
  }

  async await<T>(this: AsyncDisposer<Promise<T>>) {
    try {
      return await this.get()
    } finally {
      await this.dispose()
    }
  }

}
