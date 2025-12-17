
/**
 * A reference that will be disposed when garbage collected
 */
export class Auto<T extends Disposable> {

  static readonly cleanup = (x: Disposable) => x[Symbol.dispose]()
  static readonly registry = new FinalizationRegistry(Auto.cleanup)

  /**
   * A reference that will be disposed when garbage collected
   * @param value 
   */
  constructor(
    readonly value: T
  ) {
    Auto.registry.register(this, value, this)
  }

  [Symbol.dispose]() {
    Auto.registry.unregister(this)
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]()
  }

  get() {
    return this.value
  }

}

/**
 * A reference that will be disposed when garbage collected
 */
export class AsyncAuto<T extends AsyncDisposable> {

  static readonly cleanup = (x: AsyncDisposable) => x[Symbol.asyncDispose]().then(undefined, console.error)
  static readonly registry = new FinalizationRegistry(AsyncAuto.cleanup)

  /**
   * A reference that will be disposed when garbage collected
   * @param value 
   */
  constructor(
    readonly value: T
  ) {
    AsyncAuto.registry.register(this, value, this)
  }

  [Symbol.dispose]() {
    AsyncAuto.registry.unregister(this)
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]()
  }

  get() {
    return this.value
  }

}