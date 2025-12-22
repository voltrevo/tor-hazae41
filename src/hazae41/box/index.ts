export class Pin<T> implements Disposable {
  constructor(
    readonly value: T,
    readonly clean: () => void
  ) {}

  static with<T>(value: T, clean: (value: T) => void) {
    return new Pin(value, () => clean(value));
  }

  [Symbol.dispose]() {
    this.clean();
  }

  get() {
    return this.value;
  }
}
