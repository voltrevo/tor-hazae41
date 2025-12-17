import { Awaitable } from '../../../../libs/promises/index';
import { Simplex, SimplexParams } from '../simplex/index';

export interface FullDuplexParams<IW, IR = IW, OW = IR, OR = IW> {
  readonly input?: SimplexParams<IW, OR>;
  readonly output?: SimplexParams<OW, IR>;

  /**
   * Called when both streams are closed
   * @param this
   */
  close?(this: FullDuplex<IW, IR, OW, OR>): Awaitable<void>;

  /**
   * Called when one of the streams is errored
   * @param this
   * @param reason
   */
  error?(this: FullDuplex<IW, IR, OW, OR>, reason?: unknown): Awaitable<void>;
}

/**
 * A pair of simplexes that are closed independently
 */
export class FullDuplex<IW, IR = IW, OW = IR, OR = IW> {
  readonly inner: ReadableWritablePair<IR, IW>;
  readonly outer: ReadableWritablePair<OR, OW>;

  readonly input: Simplex<IW, OR>;
  readonly output: Simplex<OW, IR>;

  #closing?: { reason?: never };
  #closed?: { reason?: never };

  #erroring?: { reason?: unknown };
  #errored?: { reason?: unknown };

  constructor(readonly params: FullDuplexParams<IW, IR, OW, OR> = {}) {
    this.input = new Simplex<IW, OR>({
      ...params.input,
      close: () => this.#onInputClose(),
      error: e => this.#onInputError(e),
    });

    this.output = new Simplex<OW, IR>({
      ...params.output,
      close: () => this.#onOutputClose(),
      error: e => this.#onOutputError(e),
    });

    this.inner = {
      readable: this.output.readable,
      writable: this.input.writable,
    };

    this.outer = {
      readable: this.input.readable,
      writable: this.output.writable,
    };
  }

  [Symbol.dispose]() {
    this.close();
  }

  get closing() {
    return this.#closing;
  }

  get closed() {
    return this.#closed;
  }

  get erroring() {
    return this.#erroring;
  }

  get errored() {
    return this.#errored;
  }

  get stopped() {
    return this.#errored || this.#closed;
  }

  async #onInputClose() {
    if (!this.output.closing) {
      await this.params.input?.close?.call(this.input);
      return;
    }

    this.#closing = {};

    await this.params.input?.close?.call(this.input);
    await this.params.close?.call(this);

    this.#closed = {};
  }

  async #onOutputClose() {
    if (!this.input.closing) {
      await this.params.output?.close?.call(this.output);
      return;
    }

    this.#closing = {};

    await this.params.output?.close?.call(this.output);
    await this.params.close?.call(this);

    this.#closed = {};
  }

  async #onInputError(reason?: unknown) {
    if (this.#erroring) return;
    this.#erroring = { reason };

    try {
      await this.params.input?.error?.call(this.input, reason);
    } finally {
      try {
        await this.params.output?.error?.call(this.output, reason);
      } finally {
        try {
          await this.params.error?.call(this, reason);
        } finally {
          this.output.error(reason);
          this.#errored = { reason };
        }
      }
    }
  }

  async #onOutputError(reason?: unknown) {
    if (this.#erroring) return;
    this.#erroring = { reason };

    try {
      await this.params.output?.error?.call(this.output, reason);
    } finally {
      try {
        await this.params.input?.error?.call(this.input, reason);
      } finally {
        try {
          await this.params.error?.call(this, reason);
        } finally {
          this.input.error(reason);
          this.#errored = { reason };
        }
      }
    }
  }

  error(reason?: unknown) {
    this.output.error(reason);
  }

  close() {
    this.output.close();
    this.input.close();
  }
}

export interface HalfDuplexParams<IW, IR = IW, OW = IR, OR = IW> {
  readonly input?: SimplexParams<IW, OR>;
  readonly output?: SimplexParams<OW, IR>;

  /**
   * Called when one of the streams is closed
   * @param this
   */
  close?(this: HalfDuplex<IW, IR, OW, OR>): Awaitable<void>;

  /**
   * Called when one of the streams is errored
   * @param this
   * @param reason
   */
  error?(this: HalfDuplex<IW, IR, OW, OR>, reason?: unknown): Awaitable<void>;
}

/**
 * A pair of simplexes that are closed together
 */
export class HalfDuplex<IW, IR = IW, OW = IR, OR = IW> {
  readonly inner: ReadableWritablePair<IR, IW>;
  readonly outer: ReadableWritablePair<OR, OW>;

  readonly input: Simplex<IW, OR>;
  readonly output: Simplex<OW, IR>;

  #closing?: { reason?: never };
  #closed?: { reason?: never };

  #erroring?: { reason?: unknown };
  #errored?: { reason?: unknown };

  constructor(readonly params: HalfDuplexParams<IW, IR, OW, OR> = {}) {
    this.input = new Simplex<IW, OR>({
      ...params.input,
      close: () => this.#onInputClose(),
      error: e => this.#onInputError(e),
    });

    this.output = new Simplex<OW, IR>({
      ...params.output,
      close: () => this.#onOutputClose(),
      error: e => this.#onOutputError(e),
    });

    this.inner = {
      readable: this.output.readable,
      writable: this.input.writable,
    };

    this.outer = {
      readable: this.input.readable,
      writable: this.output.writable,
    };
  }

  [Symbol.dispose]() {
    this.close();
  }

  get closing() {
    return this.#closing;
  }

  get closed() {
    return this.#closed;
  }

  get erroring() {
    return this.#erroring;
  }

  get errored() {
    return this.#errored;
  }

  get stopped() {
    return this.#errored || this.#closed;
  }

  async #onInputClose() {
    if (this.#closing) return;
    this.#closing = {};

    await this.params.input?.close?.call(this.input);
    await this.params.output?.close?.call(this.output);
    await this.params.close?.call(this);

    this.output.close();
    this.#closed = {};
  }

  async #onOutputClose() {
    if (this.#closing) return;
    this.#closing = {};

    await this.params.output?.close?.call(this.output);
    await this.params.input?.close?.call(this.input);
    await this.params.close?.call(this);

    this.input.close();
    this.#closed = {};
  }

  async #onInputError(reason?: unknown) {
    if (this.#erroring) return;
    this.#erroring = { reason };

    try {
      await this.params.input?.error?.call(this.input, reason);
    } finally {
      try {
        await this.params.output?.error?.call(this.output, reason);
      } finally {
        try {
          await this.params.error?.call(this, reason);
        } finally {
          this.output.error(reason);
          this.#errored = { reason };
        }
      }
    }
  }

  async #onOutputError(reason?: unknown) {
    if (this.#erroring) return;
    this.#erroring = { reason };

    try {
      await this.params.output?.error?.call(this.output, reason);
    } finally {
      try {
        await this.params.input?.error?.call(this.input, reason);
      } finally {
        try {
          await this.params.error?.call(this, reason);
        } finally {
          this.input.error(reason);
          this.#errored = { reason };
        }
      }
    }
  }

  error(reason?: unknown) {
    this.output.error(reason);
  }

  close() {
    this.output.close();
  }
}
