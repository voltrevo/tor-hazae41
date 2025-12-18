import { Nullable } from '../../../common/Nullable';
import { Deferred } from '../deferred/index';
import { AsyncWrap, Wrap } from '../wrap/index';

export class DisposedError extends Error {
  readonly #class = DisposedError;
  readonly name = this.#class.name;

  constructor() {
    super(`Reference has been disposed`);
  }
}

/**
 * A reference that can only be disposed once
 */
export class Once<T> {
  #disposed = false;

  /**
   * A reference that can only be disposed once
   * @param value
   */
  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) {}

  static wrap<T extends Disposable>(value: T) {
    return new Once(value, value);
  }

  static from<T>(value: Wrap<T>) {
    return new Once(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Once(value, new Deferred(() => clean(value)));
  }

  [Symbol.dispose]() {
    if (this.#disposed) return;
    this.#disposed = true;

    this.clean[Symbol.dispose]();
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get disposed() {
    return this.#disposed;
  }

  get() {
    return this.value;
  }

  getOrNull(): Nullable<T> {
    if (this.#disposed) return;

    return this.value;
  }

  getOrThrow(): T {
    if (this.#disposed) throw new DisposedError();

    return this.value;
  }
}

export class AsyncOnce<T> {
  #disposed = false;

  /**
   * A reference that can only be disposed once
   * @param value
   */
  constructor(
    readonly value: T,
    readonly clean: AsyncDisposable
  ) {}

  static wrap<T extends AsyncDisposable>(value: T) {
    return new AsyncOnce(value, value);
  }

  static from<T>(value: AsyncWrap<T>) {
    return new AsyncOnce(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new AsyncOnce(value, new Deferred(() => clean(value)));
  }

  async [Symbol.asyncDispose]() {
    if (this.#disposed) return;
    this.#disposed = true;

    await this.clean[Symbol.asyncDispose]();
  }

  get disposed() {
    return this.#disposed;
  }

  get() {
    return this.value;
  }

  getOrNull(): Nullable<T> {
    if (this.#disposed) return;

    return this.value;
  }

  async getOrThrow(): Promise<T> {
    if (this.#disposed) throw new DisposedError();

    return this.value;
  }
}
