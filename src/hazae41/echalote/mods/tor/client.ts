import { WebCryptoAes128Ctr } from '../../../../TorClient/WebCryptoAes128Ctr';
import { Ciphers, TlsClientDuplex } from '../../../cadenas';
import {
  CloseEvents,
  ErrorEvents,
  Plume,
  SuperEventTarget,
} from '../../../plume';
import { Resizer } from '../../../common/Resizer';
import { Console } from '../console';
import { Sha1Hasher } from './Sha1Hasher';
import { TypedAddress } from './binary/address';
import { Cell } from './binary/cells/cell';
import { AuthChallengeCell } from './binary/cells/direct/auth_challenge/cell';
import { CertsCell } from './binary/cells/direct/certs/cell';
import { CreateFastCell } from './binary/cells/direct/create_fast/cell';
import { CreatedFastCell } from './binary/cells/direct/created_fast/cell';
import { DestroyCell } from './binary/cells/direct/destroy/cell';
import { NetinfoCell } from './binary/cells/direct/netinfo/cell';
import { PaddingCell } from './binary/cells/direct/padding/cell';
import { PaddingNegociateCell } from './binary/cells/direct/padding_negociate/cell';
import { RelayCell } from './binary/cells/direct/relay/cell';
import { VersionsCell } from './binary/cells/direct/versions/cell';
import { VariablePaddingCell } from './binary/cells/direct/vpadding/cell';
import { RelayConnectedCell } from './binary/cells/relayed/relay_connected/cell';
import { RelayDataCell } from './binary/cells/relayed/relay_data/cell';
import { RelayDropCell } from './binary/cells/relayed/relay_drop/cell';
import { RelayEndCell } from './binary/cells/relayed/relay_end/cell';
import { RelayExtended2Cell } from './binary/cells/relayed/relay_extended2/cell';
import { RelayTruncatedCell } from './binary/cells/relayed/relay_truncated/cell';
import { Circuit, SecretCircuit } from './circuit';
import { Target } from './target';
import { InvalidKdfKeyHashError, KDFTorResult } from './algorithms/kdftor.js';
import {
  ExpectedStreamError,
  InvalidCellError,
  InvalidRelayCellDigestError,
  InvalidRelaySendmeCellDigestError,
} from './binary/cells/errors.js';
import { OldCell } from './binary/cells/old.js';
import {
  RelaySendmeCircuitCell,
  RelaySendmeDigest,
  RelaySendmeStreamCell,
} from './binary/cells/relayed/relay_sendme/cell.js';
import { Certs } from './certs/certs.js';
import { InvalidTorStateError, InvalidTorVersionError } from './errors.js';
import {
  TorHandshakingState,
  TorNoneState,
  TorState,
  TorVersionedState,
} from './state.js';
import { invariant } from '../../../../utils/debug';
import { App } from '../../../../TorClient/App';
import { Bytes } from '../../../bytes';
import { Cursor } from '../../../cursor';
import { Readable, Unknown, Writable } from '../../../binary/mod';
import { X509 } from '../../../x509';
import { Bitset } from '../../../bitset';
import { HalfDuplex } from '../../../cascade';
import { Mutex } from '../../../mutex';

export interface Guard {
  readonly identity: Bytes<20>;
  readonly certs: Certs;
}

export type TorClientDuplexEvents = CloseEvents & ErrorEvents;

export class TorClientDuplex {
  readonly #secret: SecretTorClientDuplex;

  readonly events = new SuperEventTarget<TorClientDuplexEvents>();

  constructor(readonly app: App) {
    this.#secret = new SecretTorClientDuplex(app);

    this.#secret.events.on('close', () => this.events.emit('close'));
    this.#secret.events.on('error', e => this.events.emit('error', e));
  }

  [Symbol.dispose]() {
    this.close();
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

  async waitOrThrow(signal = new AbortController().signal) {
    return await this.#secret.waitOrThrow(signal);
  }

  async createOrThrow(signal = new AbortController().signal) {
    return await this.#secret.createOrThrow(signal);
  }
}

export type SecretTorEvents = CloseEvents &
  ErrorEvents & { handshaked: () => void } & {
    CREATED_FAST: (cell: Cell.Circuitful<CreatedFastCell>) => void;
    DESTROY: (cell: Cell.Circuitful<DestroyCell>) => void;
    RELAY_CONNECTED: (cell: RelayCell.Streamful<Unknown>) => void;
    RELAY_DATA: (cell: RelayCell.Streamful<RelayDataCell<Unknown>>) => void;
    RELAY_EXTENDED2: (
      cell: RelayCell.Streamless<RelayExtended2Cell<Unknown>>
    ) => void;
    RELAY_TRUNCATED: (cell: RelayCell.Streamless<RelayTruncatedCell>) => void;
    RELAY_END: (cell: RelayCell.Streamful<RelayEndCell>) => void;
  };

export class SecretTorClientDuplex {
  readonly ciphers = [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384];

  readonly tls: TlsClientDuplex;

  readonly duplex: HalfDuplex<Unknown, Writable>;

  readonly events = new SuperEventTarget<SecretTorEvents>();

  readonly circuits = new Mutex(new Map<number, SecretCircuit>());

  readonly #buffer = new Resizer();

  readonly #resolveOnStart = Promise.withResolvers<void>();
  readonly #resolveOnTlsCertificates =
    Promise.withResolvers<X509.Certificate[]>();

  #state: TorState = { type: 'none' };

  constructor(readonly app: App) {
    this.tls = new TlsClientDuplex(this.app, {
      /**
       * Do not validate root certificates
       */
      authorized: true,
      ciphers: [Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384],
      certificates: c => this.#resolveOnTlsCertificates.resolve(c),
    });

    this.duplex = new HalfDuplex<Unknown, Writable>({
      output: {
        start: () => this.#onOutputStart(),
      },
      input: {
        write: c => this.#onInputWrite(c),
      },
      close: async () => void (await this.events.emit('close')),
      error: async e => void (await this.events.emit('error', e)),
    });

    this.tls.outer.readable.pipeTo(this.duplex.inner.writable).catch(() => {});
    this.duplex.inner.readable.pipeTo(this.tls.outer.writable).catch(() => {});

    this.#resolveOnStart.resolve();
  }

  [Symbol.dispose]() {
    this.close();
  }

  get state() {
    return this.#state;
  }

  /**
   * TLS inner pair
   */
  get inner() {
    return this.tls.inner;
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

  async #onOutputStart() {
    await this.#resolveOnStart.promise;

    this.output.enqueue(
      OldCell.Circuitless.from(undefined, new VersionsCell([5]))
    );

    await Plume.waitWithCloseAndErrorOrThrow(
      this.events,
      'handshaked',
      (future: PromiseWithResolvers<void>) => future.resolve()
    );
  }

  async #onInputWrite(chunk: Unknown) {
    // Console.debug(this.constructor.name, "<-", chunk)

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
      let raw: OldCell.Raw<Unknown> | Cell.Raw<Unknown>;

      try {
        raw =
          this.#state.type === 'none'
            ? Readable.readOrRollbackAndThrow(OldCell.Raw, cursor)
            : Readable.readOrRollbackAndThrow(Cell.Raw, cursor);
      } catch {
        this.#buffer.writeOrThrow(cursor.after);
        break;
      }

      const cell = raw.unpackOrNull(this);

      if (cell == null) continue;

      await this.#onCell(cell, this.#state);
    }
  }

  async #onCell(cell: Cell<Unknown> | OldCell<Unknown>, state: TorState) {
    if (cell.command === PaddingCell.command) {
      Console.debug(cell);
      return;
    }

    if (cell.command === VariablePaddingCell.command) {
      Console.debug(cell);
      return;
    }

    if (state.type === 'none') return await this.#onNoneStateCell(cell, state);

    if (cell instanceof OldCell.Circuitful) throw new InvalidCellError();
    if (cell instanceof OldCell.Circuitless) throw new InvalidCellError();

    if (state.type === 'versioned')
      return await this.#onVersionedStateCell(cell, state);
    if (state.type === 'handshaking')
      return await this.#onHandshakingStateCell(cell, state);
    if (state.type === 'handshaked')
      return await this.#onHandshakedStateCell(cell);

    return state satisfies never;
  }

  async #onNoneStateCell(
    cell: Cell<Unknown> | OldCell<Unknown>,
    state: TorNoneState
  ) {
    if (cell instanceof Cell.Circuitful) throw new InvalidCellError();
    if (cell instanceof Cell.Circuitless) throw new InvalidCellError();

    if (cell.command === VersionsCell.command)
      return await this.#onVersionsCell(cell, state);

    console.warn(`Unknown pre-version cell ${cell.command}`);
  }

  async #onVersionedStateCell(cell: Cell<Unknown>, state: TorVersionedState) {
    if (cell.command === CertsCell.command)
      return await this.#onCertsCell(cell, state);

    console.warn(`Unknown versioned-state cell ${cell.command}`);
  }

  async #onHandshakingStateCell(
    cell: Cell<Unknown>,
    state: TorHandshakingState
  ) {
    if (cell.command === AuthChallengeCell.command)
      return await this.#onAuthChallengeCell(cell, state);
    if (cell.command === NetinfoCell.command)
      return await this.#onNetinfoCell(cell, state);

    console.warn(`Unknown handshaking-state cell ${cell.command}`);
  }

  async #onHandshakedStateCell(cell: Cell<Unknown>) {
    if (cell.command === CreatedFastCell.command)
      return await this.#onCreatedFastCell(cell);
    if (cell.command === DestroyCell.command)
      return await this.#onDestroyCell(cell);
    if (cell.command === RelayCell.command)
      return await this.#onRelayCell(cell);

    console.warn(`Unknown handshaked-state cell ${cell.command}`);
  }

  async #onVersionsCell(cell: OldCell<Unknown>, state: TorNoneState) {
    const cell2 = OldCell.Circuitless.intoOrThrow(cell, VersionsCell);

    Console.debug(cell2);

    invariant(
      state.type === 'none',
      `State must be 'none' to receive VERSIONS cell`
    );

    if (!cell2.fragment.versions.includes(5))
      throw new InvalidTorVersionError();

    this.#state = { ...state, type: 'versioned', version: 5 };
  }

  async #onCertsCell(cell: Cell<Unknown>, state: TorVersionedState) {
    const cell2 = Cell.Circuitless.intoOrThrow(cell, CertsCell);

    Console.debug(cell2);

    invariant(
      state.type === 'versioned',
      `State must be 'versioned' to receive CERTS cell, current: ${state.type}`
    );

    const tlsCerts = await this.#resolveOnTlsCertificates.promise;
    const torCerts = await Certs.verifyOrThrow(cell2.fragment.certs, tlsCerts);

    const identity = await torCerts.rsa_self.sha1OrThrow();
    const guard: Guard = { certs: torCerts, identity };

    this.#state = { ...state, type: 'handshaking', guard };
  }

  async #onAuthChallengeCell(cell: Cell<Unknown>, _state: TorHandshakingState) {
    Console.debug(Cell.Circuitless.intoOrThrow(cell, AuthChallengeCell));
  }

  async #onNetinfoCell(cell: Cell<Unknown>, state: TorHandshakingState) {
    const cell2 = Cell.Circuitless.intoOrThrow(cell, NetinfoCell);

    Console.debug(cell2);

    invariant(
      state.type === 'handshaking',
      `State must be 'handshaking' to receive NETINFO cell, current: ${state.type}`
    );
    invariant(
      state.guard !== undefined,
      `Handshaking state must have guard information`
    );

    const address = new TypedAddress(4, Bytes.from([127, 0, 0, 1]));
    const netinfo = new NetinfoCell(0, address, []);
    this.output.enqueue(Cell.Circuitless.from(undefined, netinfo));

    const pversion = PaddingNegociateCell.versions.ZERO;
    const pcommand = PaddingNegociateCell.commands.STOP;
    const padding_negociate = new PaddingNegociateCell(
      pversion,
      pcommand,
      0,
      0
    );
    this.output.enqueue(Cell.Circuitless.from(undefined, padding_negociate));

    this.#state = { ...state, type: 'handshaked' };

    await this.events.emit('handshaked');
  }

  async #onCreatedFastCell(cell: Cell<Unknown>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, CreatedFastCell);

    Console.debug(cell2);

    await this.events.emit('CREATED_FAST', cell2);
  }

  async #onDestroyCell(cell: Cell<Unknown>) {
    const cell2 = Cell.Circuitful.intoOrThrow(cell, DestroyCell);

    Console.debug(cell2);

    this.circuits.value.delete(cell2.circuit.id);

    await this.events.emit('DESTROY', cell2);
  }

  async #onRelayCell(parent: Cell<Unknown>) {
    const raw = await RelayCell.Raw.uncellOrThrow(parent);
    const cell = raw.unpackOrNull();

    if (cell == null) return;

    if (cell.rcommand === RelayExtended2Cell.rcommand)
      return await this.#onRelayExtended2Cell(cell);
    if (cell.rcommand === RelayConnectedCell.rcommand)
      return await this.#onRelayConnectedCell(cell);
    if (cell.rcommand === RelayDataCell.rcommand)
      return await this.#onRelayDataCell(cell);
    if (cell.rcommand === RelayEndCell.rcommand)
      return await this.#onRelayEndCell(cell);
    if (cell.rcommand === RelayDropCell.rcommand)
      return await this.#onRelayDropCell(cell);
    if (cell.rcommand === RelayTruncatedCell.rcommand)
      return await this.#onRelayTruncatedCell(cell);
    if (
      cell.rcommand === RelaySendmeCircuitCell.rcommand &&
      cell.stream == null
    )
      return await this.#onRelaySendmeCircuitCell(cell);
    if (cell.rcommand === RelaySendmeStreamCell.rcommand && cell.stream != null)
      return await this.#onRelaySendmeStreamCell(cell);

    console.warn(`Unknown relay cell ${cell.rcommand}`);
  }

  async #onRelayExtended2Cell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelayExtended2Cell);

    Console.debug(cell2);

    await this.events.emit('RELAY_EXTENDED2', cell2);
  }

  async #onRelayConnectedCell(cell: RelayCell<Unknown>) {
    if (cell.stream == null) throw new ExpectedStreamError();

    await this.events.emit('RELAY_CONNECTED', cell);
  }

  async #onRelayDataCell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayDataCell);

    Console.debug(cell2);

    const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1];

    exit.delivery--;

    if (exit.delivery === 900) {
      exit.delivery = 1000;

      if (cell2.digest == null) throw new InvalidRelayCellDigestError();

      const digest = new RelaySendmeDigest(cell2.digest);
      const sendme = new RelaySendmeCircuitCell(1, digest);

      const sendme_cell = RelayCell.Streamless.from(
        cell2.circuit,
        undefined,
        sendme
      );
      const cell = await sendme_cell.cellOrThrow();
      this.output.enqueue(cell);
    }

    await this.events.emit('RELAY_DATA', cell2);
  }

  async #onRelayEndCell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelayEndCell);

    Console.debug(cell2);

    await this.events.emit('RELAY_END', cell2);
  }

  async #onRelayDropCell(cell: RelayCell<Unknown>) {
    Console.debug(RelayCell.Streamful.intoOrThrow(cell, RelayDropCell));
  }

  async #onRelayTruncatedCell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(cell, RelayTruncatedCell);

    Console.debug(cell2);

    cell2.circuit.targets.pop();

    await this.events.emit('RELAY_TRUNCATED', cell2);
  }

  async #onRelaySendmeCircuitCell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamless.intoOrThrow(
      cell,
      RelaySendmeCircuitCell
    );

    Console.debug(cell2);

    if (cell2.fragment.version === 0) {
      const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1];

      exit.package += 100;

      return;
    }

    if (cell2.fragment.version === 1) {
      const digest = cell2.fragment.fragment.readIntoOrThrow(RelaySendmeDigest);

      Console.debug(digest);

      const exit = cell2.circuit.targets[cell2.circuit.targets.length - 1];
      const digest2 = exit.digests.shift();

      if (digest2 == null) throw new InvalidRelaySendmeCellDigestError();
      if (!Bytes.equals(digest.digest, digest2))
        throw new InvalidRelaySendmeCellDigestError();

      exit.package += 100;

      return;
    }

    console.warn(
      `Unknown RELAY_SENDME circuit cell version ${cell2.fragment.version}`
    );
  }

  async #onRelaySendmeStreamCell(cell: RelayCell<Unknown>) {
    const cell2 = RelayCell.Streamful.intoOrThrow(cell, RelaySendmeStreamCell);

    Console.debug(cell2);

    cell2.stream.package += 50;
  }

  async waitOrThrow(signal = new AbortController().signal) {
    if (this.state.type === 'handshaked') return;
    await Plume.waitWithCloseAndErrorOrThrow(
      this.events,
      'handshaked',
      (future: PromiseWithResolvers<void>) => future.resolve(),
      signal
    );
  }

  async #createCircuitOrThrow(signal = new AbortController().signal) {
    return await this.circuits.runOrWait(circuits => {
      while (!signal.aborted) {
        const rawCircuitId = new Cursor(Bytes.random(4)).getUint32OrThrow();

        if (rawCircuitId === 0) continue;

        const circuitId = new Bitset(rawCircuitId, 32)
          .enableBE(0)
          .unsign().value;

        if (circuits.has(circuitId)) continue;

        const circuit = new SecretCircuit(circuitId, this);

        circuits.set(circuitId, circuit);

        return circuit;
      }

      throw new Error('Aborted', { cause: signal.reason });
    });
  }

  async #waitCreatedFast(
    circuit: SecretCircuit,
    signal = new AbortController().signal
  ): Promise<Cell.Circuitful<CreatedFastCell>> {
    return await Plume.waitWithCloseAndErrorOrThrow(
      this.events,
      'CREATED_FAST',
      async (
        future: PromiseWithResolvers<Cell.Circuitful<CreatedFastCell>>,
        e
      ) => {
        if (e.circuit !== circuit) return;
        future.resolve(e);
      },
      signal
    );
  }

  async createOrThrow(signal = new AbortController().signal) {
    if (this.#state.type !== 'handshaked') throw new InvalidTorStateError();

    const circuit = await this.#createCircuitOrThrow(signal);
    const material = Bytes.random(20);

    const create_fast = new CreateFastCell(material);
    this.output.enqueue(Cell.Circuitful.from(circuit, create_fast));

    const created_fast = await this.#waitCreatedFast(circuit, signal);

    const k0 = Bytes.concat(material, created_fast.fragment.material);
    const result = await KDFTorResult.computeOrThrow(k0);

    if (!Bytes.equals(result.keyHash, created_fast.fragment.derivative))
      throw new InvalidKdfKeyHashError();

    const forwardDigest = await Sha1Hasher.createOrThrow();
    const backwardDigest = await Sha1Hasher.createOrThrow();

    await forwardDigest.updateOrThrow(result.forwardDigest);
    await backwardDigest.updateOrThrow(result.backwardDigest);

    const forwardKey = new WebCryptoAes128Ctr(
      result.forwardKey,
      Bytes.alloc(16)
    );
    const backwardKey = new WebCryptoAes128Ctr(
      result.backwardKey,
      Bytes.alloc(16)
    );

    const target = new Target(
      this.#state.guard.identity,
      circuit,
      forwardDigest,
      backwardDigest,
      forwardKey,
      backwardKey
    );

    circuit.targets.push(target);

    return new Circuit(circuit);
  }
}
