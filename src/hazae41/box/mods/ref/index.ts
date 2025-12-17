import { Deferred } from '../deferred/index';
import { AsyncWrap, Wrap } from '../wrap/index';

/**
 * A simple reference
 */
export class Ref<T> implements Disposable {
  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) {}

  static wrap<T extends Disposable>(value: T) {
    return new Ref(value, value);
  }

  static from<T>(value: Wrap<T>) {
    return new Ref(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Ref(value, new Deferred(() => clean(value)));
  }

  [Symbol.dispose]() {
    this.clean[Symbol.dispose]();
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get() {
    return this.value;
  }
}

/**
 * A simple reference
 */
export class AsyncRef<T> implements AsyncDisposable {
  constructor(
    readonly value: T,
    readonly clean: AsyncDisposable
  ) {}

  static wrap<T extends AsyncDisposable>(value: T) {
    return new AsyncRef(value, value);
  }

  static from<T>(value: AsyncWrap<T>) {
    return new AsyncRef(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new AsyncRef(value, new Deferred(() => clean(value)));
  }

  async [Symbol.asyncDispose]() {
    await this.clean[Symbol.asyncDispose]();
  }

  get() {
    return this.value;
  }
}
