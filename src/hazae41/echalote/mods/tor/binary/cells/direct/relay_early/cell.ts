import { Cursor } from '../../../../../../../cursor/mod';
import { Cell } from '../../cell';
import { SecretCircuit } from '../../../../circuit';
import { SecretTorStreamDuplex } from '../../../../stream';
import {
  ExpectedCircuitError,
  ExpectedStreamError,
  InvalidRelayCommandError,
  UnexpectedStreamError,
  UnknownStreamError,
  UnrecognisedRelayCellError,
} from '../../errors.js';
import { Bytes } from '../../../../../../../bytes';
import { Readable, Unknown, Writable } from '../../../../../../../binary/mod';

export interface RelayEarlyCellable {
  readonly rcommand: number;
  readonly early: true;
  readonly stream: boolean;
}

export namespace RelayEarlyCellable {
  export interface Streamful {
    readonly rcommand: number;
    readonly early: true;
    readonly stream: true;
  }

  export interface Streamless {
    readonly rcommand: number;
    readonly early: true;
    readonly stream: false;
  }
}

export type RelayEarlyCell<T extends Writable> =
  | RelayEarlyCell.Streamful<T>
  | RelayEarlyCell.Streamless<T>;

export namespace RelayEarlyCell {
  export const HEAD_LEN = 1 + 2 + 2 + 4 + 2;
  export const DATA_LEN = Cell.PAYLOAD_LEN - HEAD_LEN;

  export const command = 9;

  export class Raw<T extends Writable> {
    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: number,
      readonly rcommand: number,
      readonly fragment: T
    ) {}

    unpackOrThrow() {
      if (this.stream === 0)
        return new Streamless(
          this.circuit,
          undefined,
          this.rcommand,
          this.fragment
        );

      const stream = this.circuit.streams.get(this.stream);

      if (stream == null) throw new UnknownStreamError();

      return new Streamful(this.circuit, stream, this.rcommand, this.fragment);
    }

    async cellOrThrow() {
      const cursor = new Cursor(Bytes.alloc(Cell.PAYLOAD_LEN));

      cursor.writeUint8OrThrow(this.rcommand);
      cursor.writeUint16OrThrow(0);
      cursor.writeUint16OrThrow(this.stream);

      const digestOffset = cursor.offset;

      cursor.writeUint32OrThrow(0);

      const size = this.fragment.sizeOrThrow();
      cursor.writeUint16OrThrow(size);
      this.fragment.writeOrThrow(cursor);

      cursor.fillOrThrow(0, Math.min(cursor.remaining, 4));
      cursor.writeOrThrow(Bytes.random(cursor.remaining));

      const exit = this.circuit.targets[this.circuit.targets.length - 1];

      exit.forward_digest.updateOrThrow(cursor.bytes);

      const digestSlice = exit.forward_digest.finalizeOrThrow();

      cursor.offset = digestOffset;
      cursor.writeOrThrow(digestSlice.subarray(0, 4));

      const bytes = Bytes.from(cursor.bytes);

      for (let i = this.circuit.targets.length - 1; i >= 0; i--)
        await this.circuit.targets[i].forward_key.apply_keystream(bytes);

      const fragment = new Unknown(bytes);

      return new Cell.Circuitful(
        this.circuit,
        RelayEarlyCell.command,
        fragment
      );
    }

    static async uncellOrThrow(cell: Cell<Unknown>) {
      if (cell instanceof Cell.Circuitless) throw new ExpectedCircuitError();

      const bytes = Bytes.from(cell.fragment.bytes);

      for (const target of cell.circuit.targets) {
        await target.backward_key.apply_keystream(bytes);

        const cursor = new Cursor(bytes);

        const rcommand = cursor.readUint8OrThrow();
        const recognised = cursor.readUint16OrThrow();

        if (recognised !== 0) continue;

        const stream = cursor.readUint16OrThrow();

        const offset = cursor.offset;
        const digest4 = cursor.getAndCopyOrThrow(4);

        cursor.writeUint32OrThrow(0);

        const hasher = await target.backward_digest.cloneOrThrow();
        hasher.updateOrThrow(cursor.bytes);
        const digest = hasher.finalizeOrThrow();

        if (!Bytes.equals2(digest4, digest.subarray(0, 4))) {
          cursor.offset = offset;
          cursor.writeOrThrow(digest4);
          continue;
        }

        target.backward_digest.updateOrThrow(cursor.bytes);

        const length = cursor.readUint16OrThrow();
        const bytes_data = cursor.readAndCopyOrThrow(length);
        const data = new Unknown(bytes_data);

        return new Raw<Unknown>(cell.circuit, stream, rcommand, data);
      }

      throw new UnrecognisedRelayCellError();
    }
  }

  export class Streamful<T extends Writable> {
    readonly #raw: Raw<T>;

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: SecretTorStreamDuplex,
      readonly rcommand: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw(circuit, stream.id, rcommand, fragment);
    }

    static from<T extends RelayEarlyCellable.Streamful & Writable>(
      circuit: SecretCircuit,
      stream: SecretTorStreamDuplex,
      fragment: T
    ) {
      return new Streamful(circuit, stream, fragment.rcommand, fragment);
    }

    async cellOrThrow() {
      return await this.#raw.cellOrThrow();
    }

    static intoOrThrow<T extends Writable>(
      cell: RelayEarlyCell<Unknown>,
      readable: RelayEarlyCellable.Streamful & Readable<T>
    ) {
      if (cell.rcommand !== readable.rcommand)
        throw new InvalidRelayCommandError();
      if (cell.stream == null) throw new ExpectedStreamError();

      const fragment = cell.fragment.readIntoOrThrow(readable);

      return new Streamful(
        cell.circuit,
        cell.stream,
        readable.rcommand,
        fragment
      );
    }
  }

  export class Streamless<T extends Writable> {
    readonly #raw: Raw<T>;

    constructor(
      readonly circuit: SecretCircuit,
      readonly stream: undefined,
      readonly rcommand: number,
      readonly fragment: T
    ) {
      this.#raw = new Raw(circuit, 0, rcommand, fragment);
    }

    static from<T extends RelayEarlyCellable.Streamless & Writable>(
      circuit: SecretCircuit,
      stream: undefined,
      fragment: T
    ) {
      return new Streamless(circuit, stream, fragment.rcommand, fragment);
    }

    async cellOrThrow() {
      return await this.#raw.cellOrThrow();
    }

    static intoOrThrow<T extends Writable>(
      cell: RelayEarlyCell<Unknown>,
      readable: RelayEarlyCellable.Streamless & Readable<T>
    ) {
      if (cell.rcommand !== readable.rcommand)
        throw new InvalidRelayCommandError();
      if (cell.stream != null) throw new UnexpectedStreamError();

      const fragment = cell.fragment.readIntoOrThrow(readable);

      return new Streamless(
        cell.circuit,
        cell.stream,
        readable.rcommand,
        fragment
      );
    }
  }
}
