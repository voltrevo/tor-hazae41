/**
 * A reference that will be disposed after some delay
 */
export class Tick<T extends Disposable> {
  #timeout: NodeJS.Timeout;

  /**
   * A reference that will be disposed after some delay
   * @param value
   * @param delay
   */
  constructor(
    readonly value: T,
    readonly delay: number = 0
  ) {
    this.#timeout = setTimeout(() => this.value[Symbol.dispose](), delay);
  }

  [Symbol.dispose]() {
    clearTimeout(this.#timeout);
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get() {
    return this.value;
  }
}

/**
 * A reference that will be disposed after some delay
 */
export class AsyncTick<T extends AsyncDisposable> {
  #timeout: NodeJS.Timeout;

  /**
   * A reference that will be disposed after some delay
   * @param value
   * @param delay
   */
  constructor(
    readonly value: T,
    readonly delay: number = 0
  ) {
    this.#timeout = setTimeout(
      () => this.value[Symbol.asyncDispose]().then(undefined, console.error),
      delay
    );
  }

  [Symbol.dispose]() {
    clearTimeout(this.#timeout);
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get() {
    return this.value;
  }
}
