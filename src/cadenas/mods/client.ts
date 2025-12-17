import { Opaque, Readable, Writable } from '@hazae41/binary';
import { FullDuplex } from '@hazae41/cascade';
import { Future } from '@hazae41/future';
import { X509 } from '@hazae41/x509';
import { Awaitable } from '../libs/promises/index.js';
import { Resizer } from '../libs/resizer/resizer.js';
import { PlaintextRecord } from '../mods/binary/records/record.js';
import { Cipher } from '../mods/ciphers/cipher.js';
import { TlsClientNoneState, TlsClientState } from './state.js';
import { App } from '../../TorClient/App.js';
import { Bytes } from '../../hazae41/bytes/index.js';
import { Cursor } from '../../hazae41/cursor/mod.js';

export interface TlsClientDuplexParams {
  /**
   * Supported ciphers
   */
  readonly ciphers: Cipher[];

  /**
   * Used for SNI and certificates verification, leave null to disable
   */
  readonly host_name?: string;

  /**
   * Do not verify certificates against root certificate authorities
   */
  readonly authorized?: boolean;

  /**
   * Called on close
   */
  close?(this: TlsClientDuplex): Awaitable<void>;

  /**
   * Called on error
   */
  error?(this: TlsClientDuplex, reason?: unknown): Awaitable<void>;

  /**
   * Called on handshake
   */
  handshake?(this: TlsClientDuplex): Awaitable<void>;

  /**
   * Called on certificates
   */
  certificates?(
    this: TlsClientDuplex,
    certificates: X509.Certificate[]
  ): Awaitable<void>;
}

export class TlsClientDuplex {
  readonly duplex: FullDuplex<Opaque, Writable>;

  readonly #buffer = new Resizer();

  state: TlsClientState;

  readonly resolveOnStart = new Future<void>();
  readonly resolveOnClose = new Future<void>();
  readonly resolveOnError = new Future<unknown>();
  readonly resolveOnHandshake = new Future<void>();

  constructor(
    readonly app: App,
    readonly params: TlsClientDuplexParams
  ) {
    this.duplex = new FullDuplex<Opaque, Writable>({
      input: {
        write: m => this.#onInputWrite(m),
      },
      output: {
        start: () => this.#onOutputStart(),
        write: m => this.#onOutputWrite(m),
      },
      close: () => this.#onDuplexClose(),
      error: e => this.#onDuplexError(e),
    });

    this.state = new TlsClientNoneState(app, this);

    this.resolveOnStart.resolve();
  }

  [Symbol.dispose]() {
    this.close();
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

  error(reason?: unknown) {
    this.duplex.error(reason);
  }

  close() {
    this.duplex.close();
  }

  async #onDuplexClose() {
    this.resolveOnClose.resolve();
    await this.params.close?.call(this);
  }

  async #onDuplexError(cause?: unknown) {
    this.resolveOnError.resolve(cause);
    await this.params.error?.call(this);
  }

  async #onOutputStart() {
    await this.resolveOnStart.promise;
    await this.state.onOutputStart();
  }

  async #onInputWrite(chunk: Opaque) {
    // Console.debug(this.#class.name, "<-", chunk)

    if (this.#buffer.inner.offset) await this.#onReadBuffered(chunk.bytes);
    else await this.#onReadDirect(chunk.bytes);
  }

  /**
   * Read from buffer
   * @param chunk
   * @returns
   */
  async #onReadBuffered(chunk: Bytes) {
    this.#buffer.writeOrThrow(chunk);
    const full = Bytes.from(this.#buffer.inner.before);

    this.#buffer.inner.offset = 0;
    await this.#onReadDirect(full);
  }

  /**
   * Zero-copy reading
   * @param chunk
   * @returns
   */
  async #onReadDirect(chunk: Bytes) {
    const cursor = new Cursor(chunk);

    while (cursor.remaining) {
      let record: PlaintextRecord<Opaque>;

      try {
        record = Readable.readOrRollbackAndThrow(PlaintextRecord, cursor);
      } catch {
        // FIXME: This throws a lot but seems to be intended.
        //        (Tried logging this and it was noisy but no actual issues.)
        this.#buffer.writeOrThrow(cursor.after);
        break;
      }

      await this.#onRecord(record);
    }
  }

  async #onOutputWrite(chunk: Writable) {
    await this.state.onOutputWrite(chunk);
  }

  async #onRecord(record: PlaintextRecord<Opaque>) {
    await this.state.onRecord(record);
  }
}
