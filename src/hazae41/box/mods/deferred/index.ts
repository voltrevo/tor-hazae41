export class Deferred {
  constructor(readonly value: () => void) {}

  static void() {
    return new Deferred(() => {});
  }

  [Symbol.dispose]() {
    this.value();
  }

  async [Symbol.asyncDispose]() {
    this[Symbol.dispose]();
  }

  get() {
    return this.value;
  }
}

export class AsyncDeferred {
  constructor(readonly value: () => PromiseLike<void>) {}

  static void() {
    return new AsyncDeferred(async () => {});
  }

  async [Symbol.asyncDispose]() {
    await this.value();
  }

  get() {
    return this.value;
  }
}
