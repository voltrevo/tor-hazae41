import { Readable } from '../../../../binary/mod.ts';
import { FullDuplex } from '../../../../cascade/index.ts';
import { Cursor } from '../../../../cursor/mod.ts';
import { Future } from '../../../../future/index.ts';
import { SecretSmuxReader } from '../reader/index';
import { SecretSmuxWriter } from '../writer/index';

export interface SmuxDuplexParams {
  readonly stream?: number;

  close?(this: undefined): Promise<void>;
  error?(this: undefined, reason?: unknown): Promise<void>;
}

export class SmuxDuplex {
  readonly #secret: SecretSmuxDuplex;

  constructor(readonly params: SmuxDuplexParams = {}) {
    this.#secret = new SecretSmuxDuplex(params);
  }

  [Symbol.dispose]() {
    this.close();
  }

  get stream() {
    return this.#secret.stream;
  }

  get inner() {
    return this.#secret.inner;
  }

  get outer() {
    return this.#secret.outer;
  }

  get closing() {
    return this.#secret.closing;
  }

  get closed() {
    return this.#secret.closed;
  }

  error(reason?: unknown) {
    this.#secret.error(reason);
  }

  close() {
    this.#secret.close();
  }
}

export class SecretSmuxDuplex {
  readonly duplex: FullDuplex<any, Writable>;

  readonly reader: SecretSmuxReader;
  readonly writer: SecretSmuxWriter;

  readonly buffer = new Cursor(new Uint8Array(65_535));

  readonly stream: number;

  selfRead = 0;
  selfWrite = 0;
  selfIncrement = 0;

  peerConsumed = 0;
  peerWindow = 65_535;

  readonly resolveOnStart = new Future<void>();

  constructor(readonly params: SmuxDuplexParams = {}) {
    const { stream = 3 } = params;

    this.stream = stream;

    this.reader = new SecretSmuxReader(this);
    this.writer = new SecretSmuxWriter(this);

    this.duplex = new FullDuplex<any, Writable>({
      input: {
        write: m => this.reader.onWrite(m),
      },
      output: {
        start: () => this.writer.onStart(),
        write: m => this.writer.onWrite(m),
      },
      close: () => this.#onDuplexClose(),
      error: e => this.#onDuplexError(e),
    });

    this.resolveOnStart.resolve();
  }

  [Symbol.dispose]() {
    this.close();
  }

  get selfWindow() {
    return this.buffer.bytes.length;
  }

  get inner() {
    return this.duplex.inner;
  }

  get outer() {
    return this.duplex.outer;
  }

  get input() {
    return this.duplex.input;
  }

  get output() {
    return this.duplex.output;
  }

  get closing() {
    return this.duplex.closing;
  }

  get closed() {
    return this.duplex.closed;
  }

  async #onDuplexClose() {
    await this.params.close?.call(undefined);
  }

  async #onDuplexError(reason?: unknown) {
    await this.params.error?.call(undefined, reason);
  }

  error(reason?: unknown) {
    this.duplex.error(reason);
  }

  close() {
    this.duplex.close();
  }
}
