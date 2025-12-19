import { CloseEvents, ErrorEvents, SuperEventTarget } from '../../../plume';
import { Console } from '../console';
import { RelayCell } from './binary/cells/direct/relay/cell';
import { RelayDataCell } from './binary/cells/relayed/relay_data/cell';
import { RelayEndCell } from './binary/cells/relayed/relay_end/cell';
import { SecretCircuit } from './circuit';
import { RelayConnectedCell } from './binary/cells/relayed/relay_connected/cell.js';
import {
  RelayEndReason,
  RelayEndReasonOther,
} from './binary/cells/relayed/relay_end/reason.js';
import { RelaySendmeStreamCell } from './binary/cells/relayed/relay_sendme/cell.js';
import { Cursor } from '../../../cursor';
import { Unknown, Writable } from '../../../binary/mod';
import { FullDuplex } from '../../../cascade';

export class TorStreamDuplex {
  readonly #secret: SecretTorStreamDuplex;

  constructor(secret: SecretTorStreamDuplex) {
    this.#secret = secret;
  }

  [Symbol.dispose]() {
    this.close();
  }

  get id() {
    return this.#secret.id;
  }

  get type() {
    return this.#secret.type;
  }

  get inner() {
    return this.#secret.inner;
  }

  get outer() {
    return this.#secret.outer;
  }

  error(reason?: unknown) {
    this.#secret.error(reason);
  }

  close() {
    this.#secret.close();
  }
}

export class RelayEndedError extends Error {
  readonly #class = RelayEndedError;
  readonly name = this.constructor.name;

  constructor(readonly reason: RelayEndReason) {
    super(`Relay ended`, { cause: reason });
  }
}

export type TorStreamEvents = CloseEvents &
  ErrorEvents & { connected: () => void };

export type SecretTorStreamDuplexType = 'external' | 'directory';

export class SecretTorStreamDuplex {
  readonly #class = SecretTorStreamDuplex;

  readonly duplex: FullDuplex<Unknown, Writable>;

  readonly events = new SuperEventTarget<TorStreamEvents>();

  delivery = 500;
  package = 500;

  #onClean: () => void;

  constructor(
    readonly type: SecretTorStreamDuplexType,
    readonly id: number,
    readonly circuit: SecretCircuit
  ) {
    this.duplex = new FullDuplex<Unknown, Writable>({
      output: {
        write: c => this.#onOutputWrite(c),
      },
      error: e => this.#onDuplexError(e),
      close: () => this.#onDuplexClose(),
    });

    const onCircuitClose = this.#onCircuitClose.bind(this);
    const onCircuitError = this.#onCircuitError.bind(this);

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this);
    const onRelayDataCell = this.#onRelayDataCell.bind(this);
    const onRelayEndCell = this.#onRelayEndCell.bind(this);

    this.circuit.events.on('close', onCircuitClose, { passive: true });
    this.circuit.events.on('error', onCircuitError, { passive: true });

    this.circuit.events.on('RELAY_CONNECTED', onRelayConnectedCell, {
      passive: true,
    });
    this.circuit.events.on('RELAY_DATA', onRelayDataCell, { passive: true });
    this.circuit.events.on('RELAY_END', onRelayEndCell, { passive: true });

    this.#onClean = () => {
      this.circuit.events.off('close', onCircuitClose);
      this.circuit.events.off('error', onCircuitError);

      this.circuit.events.off('RELAY_CONNECTED', onRelayConnectedCell);
      this.circuit.events.off('RELAY_DATA', onRelayDataCell);
      this.circuit.events.off('RELAY_END', onRelayEndCell);

      this.circuit.streams.delete(this.id);

      this.#onClean = () => {};
    };
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

  get closed() {
    return this.duplex.closed;
  }

  close() {
    this.duplex.close();
  }

  error(reason?: unknown) {
    this.duplex.error(reason);
  }

  async #onDuplexClose() {
    if (!this.circuit.closed) {
      const relay_end_cell = new RelayEndCell(
        new RelayEndReasonOther(RelayEndCell.reasons.REASON_DONE)
      );
      const relay_cell = RelayCell.Streamful.from(
        this.circuit,
        this,
        relay_end_cell
      );
      this.circuit.tor.output.enqueue(await relay_cell.cellOrThrow());

      this.package--;
    }

    await this.events.emit('close');

    this.#onClean();
  }

  async #onDuplexError(reason?: unknown) {
    if (!this.circuit.closed) {
      const relay_end_cell = new RelayEndCell(
        new RelayEndReasonOther(RelayEndCell.reasons.REASON_DONE)
      );
      const relay_cell = RelayCell.Streamful.from(
        this.circuit,
        this,
        relay_end_cell
      );
      const cell = await relay_cell.cellOrThrow();
      this.circuit.tor.output.enqueue(cell);

      this.package--;
    }

    await this.events.emit('error', reason);

    this.#onClean();
  }

  async #onCircuitClose() {
    Console.debug(`${this.constructor.name}.onCircuitClose`);

    if (this.duplex.closing) return;

    this.duplex.close();
  }

  async #onCircuitError(reason?: unknown) {
    Console.debug(`${this.constructor.name}.onCircuitError`, { reason });

    if (this.duplex.closing) return;

    this.duplex.error(reason);
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<Unknown>) {
    if (cell.stream !== this) return;

    if (this.type === 'directory') {
      await this.events.emit('connected');
      return;
    }

    if (this.type === 'external') {
      const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayConnectedCell);

      Console.debug(`${this.constructor.name}.onRelayConnectedCell`, cell2);

      await this.events.emit('connected');
      return;
    }
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Unknown>>) {
    if (cell.stream !== this) return;

    Console.debug(`${this.constructor.name}.onRelayDataCell`, cell);

    this.delivery--;

    if (this.delivery === 450) {
      this.delivery = 500;

      const sendme = new RelaySendmeStreamCell();
      const sendme_cell = RelayCell.Streamful.from(this.circuit, this, sendme);
      const cell = await sendme_cell.cellOrThrow();
      this.circuit.tor.output.enqueue(cell);
    }

    this.input.enqueue(cell.fragment.fragment);
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.stream !== this) return;

    Console.debug(`${this.constructor.name}.onRelayEndCell`, cell);

    if (this.duplex.closing) return;

    if (cell.fragment.reason.id === RelayEndCell.reasons.REASON_DONE)
      this.duplex.close();
    else this.duplex.error(new RelayEndedError(cell.fragment.reason));
  }

  async #onOutputWrite(writable: Writable) {
    if (writable.sizeOrThrow() > RelayCell.DATA_LEN)
      return await this.#onWriteChunked(writable);

    return await this.#onWriteDirect(writable);
  }

  async #onWriteDirect(writable: Writable) {
    const relay_data_cell = new RelayDataCell(writable);
    const relay_cell = RelayCell.Streamful.from(
      this.circuit,
      this,
      relay_data_cell
    );

    const cell = await relay_cell.cellOrThrow();
    this.circuit.tor.output.enqueue(cell);

    this.package--;
  }

  async #onWriteChunked(writable: Writable) {
    const bytes = Writable.writeToBytesOrThrow(writable);
    const cursor = new Cursor(bytes);

    for (const chunk of cursor.splitOrThrow(RelayCell.DATA_LEN))
      await this.#onWriteDirect(new Unknown(chunk));

    return;
  }
}
