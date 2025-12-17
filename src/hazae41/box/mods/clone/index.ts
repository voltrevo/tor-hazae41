import { Deferred } from '../deferred/index';
import { Void } from '../void/index';
import { Wrap } from '../wrap/index';

export class Clone<T> {
  #count = 1;

  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) {}

  static void() {
    return new Clone<void>(undefined, new Void());
  }

  static wrap<T extends Disposable>(value: T) {
    return new Clone(value, value);
  }

  static from<T>(value: Wrap<T>) {
    return new Clone(value.get(), value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Clone(value, new Deferred(() => clean(value)));
  }

  [Symbol.dispose]() {
    this.#count--;

    if (this.#count > 0) return;

    this.clean[Symbol.dispose]();
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get count() {
    return this.#count;
  }

  get() {
    return this.value;
  }

  clone() {
    this.#count++;
    return this;
  }
}
