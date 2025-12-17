/**
 * An interior mutable reference
 */
export class Cell<T> {

  /**
   * A mutable reference
   * @param value 
   */
  constructor(
    public value: T
  ) { }

  [Symbol.dispose](this: Cell<Disposable>) {
    this.value[Symbol.dispose]()
  }

  async [Symbol.asyncDispose](this: Cell<AsyncDisposable>) {
    await this.value[Symbol.asyncDispose]()
  }

  get() {
    return this.value
  }

  set(value: T) {
    this.value = value
  }

  getAndSet(value: T) {
    const old = this.value
    this.value = value
    return old
  }

}