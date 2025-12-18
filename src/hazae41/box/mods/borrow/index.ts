import { Nullable } from '../../../common/Nullable';
import { Deferred } from '../deferred';
import { Ref } from '../ref';
import { Wrap } from '../wrap';

export class BorrowedError extends Error {
  readonly #class = BorrowedError;
  readonly name = this.#class.name;

  constructor() {
    super(`Resource is borrowed`);
  }
}

export interface Borrowable<T> {
  readonly borrowed: boolean;

  get(): T;

  getOrNull(): Nullable<T>;

  getOrThrow(): T;

  checkOrNull(): Nullable<this>;

  checkOrThrow(): this;

  borrowOrNull(): Nullable<Ref<T>>;

  borrowOrThrow(): Ref<T>;
}

/**
 * A borrowable reference
 * @param value
 */
export class Borrow<T> implements Disposable, Borrowable<T> {
  #borrowed = false;

  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) {}

  static wrap<T extends Disposable>(value: T) {
    return new Borrow(value, value);
  }

  static from<T>(value: Wrap<T>) {
    return new Borrow(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Borrow(value, new Deferred(() => clean(value)));
  }

  [Symbol.dispose]() {
    this.clean[Symbol.dispose]();
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get borrowed() {
    return this.#borrowed;
  }

  get() {
    return this.value;
  }

  getOrNull(): Nullable<T> {
    if (this.#borrowed) return;

    return this.value;
  }

  getOrThrow(): T {
    if (this.#borrowed) throw new BorrowedError();

    return this.value;
  }

  checkOrNull(): Nullable<this> {
    if (this.#borrowed) return;

    return this;
  }

  checkOrThrow(): this {
    if (this.#borrowed) throw new BorrowedError();

    return this;
  }

  borrowOrNull(): Nullable<Ref<T>> {
    if (this.#borrowed) return;

    this.#borrowed = true;

    const dispose = () => {
      this.#borrowed = false;
    };

    return new Ref(this.value, new Deferred(dispose));
  }

  borrowOrThrow(): Ref<T> {
    if (this.#borrowed) throw new BorrowedError();

    this.#borrowed = true;

    const dispose = () => {
      this.#borrowed = false;
    };

    return new Ref(this.value, new Deferred(dispose));
  }
}
