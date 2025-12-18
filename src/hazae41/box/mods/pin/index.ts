import { Deferred } from '../deferred';

export class Pin<T> implements Disposable {
  constructor(
    readonly value: T,
    readonly clean: Disposable
  ) {}

  static from<T extends Disposable>(value: T) {
    return new Pin(value, value);
  }

  static with<T>(value: T, clean: (value: T) => void) {
    return new Pin(value, new Deferred(() => clean(value)));
  }

  [Symbol.dispose]() {
    this.clean[Symbol.dispose]();
  }

  get() {
    return this.value;
  }

  getAndDispose() {
    this[Symbol.dispose]();

    return this.value;
  }
}
