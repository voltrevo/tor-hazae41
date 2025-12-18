import { Empty, Readable, Writable } from '../../../../binary/mod';
import { Bytes } from '../../../../bytes';
import { Cursor } from '../../../../cursor/mod';
import { SmuxSegment, SmuxUpdate } from '../segment';
import { SecretSmuxDuplex } from '../stream';

export type SmuxReadError =
  | UnknownSmuxCommandError
  | InvalidSmuxVersionError
  | InvalidSmuxStreamError;

export class UnknownSmuxCommandError extends Error {
  readonly #class = UnknownSmuxCommandError;
  readonly name = this.#class.name;

  constructor() {
    super(`Unknown SMUX command`);
  }
}

export class InvalidSmuxVersionError extends Error {
  readonly #class = InvalidSmuxVersionError;
  readonly name = this.#class.name;

  constructor(readonly version: number) {
    super(`Invalid SMUX version ${version}`);
  }
}

export class InvalidSmuxStreamError extends Error {
  readonly #class = InvalidSmuxStreamError;
  readonly name = this.#class.name;

  constructor(readonly stream: number) {
    super(`Invalid SMUX stream ${stream}`);
  }
}

export class SecretSmuxReader {
  constructor(readonly parent: SecretSmuxDuplex) {}

  // fixme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onWrite(chunk: any) {
    if (this.parent.buffer.offset)
      return await this.#onReadBuffered(chunk.bytes);
    else return await this.#onReadDirect(chunk.bytes);
  }

  async #onReadBuffered(chunk: Bytes) {
    this.parent.buffer.writeOrThrow(chunk);
    const full = Bytes.from(this.parent.buffer.before);

    this.parent.buffer.offset = 0;
    return await this.#onReadDirect(full);
  }

  async #onReadDirect(chunk: Bytes) {
    const cursor = new Cursor(chunk);

    while (cursor.remaining) {
      let segment: SmuxSegment<Writable>;

      try {
        segment = Readable.readOrRollbackAndThrow(SmuxSegment, cursor);
      } catch {
        this.parent.buffer.writeOrThrow(cursor.after);
        break;
      }

      await this.#onSegment(segment);
    }
  }

  async #onSegment(segment: SmuxSegment<Writable>) {
    if (segment.version !== 2)
      throw new InvalidSmuxVersionError(segment.version);

    // Console.log("<-", segment)

    if (segment.command === SmuxSegment.commands.psh)
      return await this.#onPshSegment(segment);
    if (segment.command === SmuxSegment.commands.nop)
      return await this.#onNopSegment(segment);
    if (segment.command === SmuxSegment.commands.upd)
      return await this.#onUpdSegment(segment);
    if (segment.command === SmuxSegment.commands.fin)
      return await this.#onFinSegment(segment);

    throw new UnknownSmuxCommandError();
  }

  // fixme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async #onPshSegment(segment: SmuxSegment<any>) {
    if (segment.stream !== this.parent.stream)
      throw new InvalidSmuxStreamError(segment.stream);

    this.parent.selfRead += segment.fragment.bytes.length;
    this.parent.selfIncrement += segment.fragment.bytes.length;

    this.parent.input.enqueue(segment.fragment);

    if (this.parent.selfIncrement >= this.parent.selfWindow / 2) {
      const version = 2;
      const command = SmuxSegment.commands.upd;
      const stream = this.parent.stream;
      const fragment = new SmuxUpdate(
        this.parent.selfRead,
        this.parent.selfWindow
      );

      const segment = SmuxSegment.newOrThrow({
        version,
        command,
        stream,
        fragment,
      });

      this.parent.output.enqueue(segment);

      this.parent.selfIncrement = 0;
    }
  }

  async #onNopSegment(ping: SmuxSegment<Writable>) {
    const version = 2;
    const command = SmuxSegment.commands.nop;
    const stream = ping.stream;
    const fragment = new Empty();

    const pong = SmuxSegment.empty({ version, command, stream, fragment });

    this.parent.output.enqueue(pong);
  }

  // fixme
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async #onUpdSegment(segment: SmuxSegment<any>) {
    if (segment.stream !== this.parent.stream)
      throw new InvalidSmuxStreamError(segment.stream);

    const update = segment.fragment.readIntoOrThrow(SmuxUpdate);

    this.parent.peerConsumed = update.consumed;
    this.parent.peerWindow = update.window;
  }

  async #onFinSegment(segment: SmuxSegment<Writable>) {
    if (segment.stream !== this.parent.stream)
      throw new InvalidSmuxStreamError(segment.stream);

    this.parent.output.close();
  }
}
