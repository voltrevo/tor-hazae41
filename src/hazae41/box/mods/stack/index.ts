/**
 * A stack of disposable objects
 */
export class Stack<T extends Disposable> {

  /**
   * A stack of disposable objects
   */
  constructor(
    readonly value: T[] = []
  ) { }

  [Symbol.iterator]() {
    return this.value[Symbol.iterator]()
  }

  [Symbol.dispose](this: Stack<Disposable>) {
    for (const value of this.value)
      value[Symbol.dispose]()
    //
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]()
  }

  push(value: T) {
    this.value.push(value)
  }

  get() {
    return this.value
  }

}

export class AsyncStack<T extends AsyncDisposable> {

  /**
   * A stack of disposable objects
   */
  constructor(
    readonly value: T[] = []
  ) { }

  [Symbol.iterator]() {
    return this.value[Symbol.iterator]()
  }

  async [Symbol.asyncDispose]() {
    for (const value of this.value)
      await value[Symbol.asyncDispose]()
    //
  }

  push(value: T) {
    this.value.push(value)
  }

  get() {
    return this.value
  }

}

