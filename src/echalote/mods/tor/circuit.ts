import { VerifiedAes128Ctr } from '../../../TorClient/VerifiedAes128Ctr';
import { Base64 } from '@hazae41/base64';
import { Opaque } from '@hazae41/binary';
import { Bitset } from '@hazae41/bitset';
import { Bytes } from '@hazae41/bytes';
import { Future } from '@hazae41/future';
import { Option } from '@hazae41/option';
import {
  CloseEvents,
  ErrorEvents,
  Plume,
  SuperEventTarget,
} from '@hazae41/plume';
import { Sha1Hasher } from './Sha1Hasher';
import { X25519 } from './x25519';
import { Console } from '../console/index';
import { Ntor } from './algorithms/ntor/index';
import { DestroyCell } from './binary/cells/direct/destroy/cell';
import { RelayBeginCell } from './binary/cells/relayed/relay_begin/cell';
import { RelayDataCell } from './binary/cells/relayed/relay_data/cell';
import { RelayEndCell } from './binary/cells/relayed/relay_end/cell';
import { RelayExtend2Cell } from './binary/cells/relayed/relay_extend2/cell';
import {
  RelayExtend2Link,
  RelayExtend2LinkIPv4,
  RelayExtend2LinkIPv6,
  RelayExtend2LinkLegacyID,
  RelayExtend2LinkModernID,
} from './binary/cells/relayed/relay_extend2/link';
import { RelayExtended2Cell } from './binary/cells/relayed/relay_extended2/cell';
import { RelayTruncateCell } from './binary/cells/relayed/relay_truncate/cell';
import { RelayTruncatedCell } from './binary/cells/relayed/relay_truncated/cell';
import { SecretTorClientDuplex } from './client';
import { SecretTorStreamDuplex, TorStreamDuplex } from './stream';
import { Target } from './target';
import { InvalidNtorAuthError, NtorResult } from './algorithms/ntor/ntor.js';
import { Cell } from './binary/cells/cell.js';
import { RelayCell } from './binary/cells/direct/relay/cell.js';
import { RelayEarlyCell } from './binary/cells/direct/relay_early/cell.js';
import { RelayBeginDirCell } from './binary/cells/relayed/relay_begin_dir/cell.js';
import { Consensus } from './consensus/consensus.js';
import { HASH_LEN } from './constants.js';
import { invariant } from '../../../utils/debug';

export const IPv6 = {
  always: 3,
  preferred: 2,
  avoided: 1,
  never: 0,
} as const;

export interface CircuitOpenParams {
  /**
   * Wait RELAY_CONNECTED
   */
  readonly wait?: boolean;

  /**
   * IPv6 preference
   */
  readonly ipv6?: keyof typeof IPv6;
}

export class UnknownProtocolError extends Error {
  readonly #class = UnknownProtocolError;
  readonly name = this.constructor.name;

  constructor(readonly protocol: string) {
    super(`Unknown protocol "${protocol}"`);
  }
}

export class DestroyedError extends Error {
  readonly #class = DestroyedError;
  readonly name = this.constructor.name;

  constructor(readonly reason: number) {
    super(`Circuit destroyed`, { cause: reason });
  }
}

export class ExtendError extends Error {
  readonly #class = ExtendError;
  readonly name = this.constructor.name;

  constructor(options: ErrorOptions) {
    super(`Could not extend`, options);
  }

  static from(cause: unknown) {
    return new ExtendError({ cause });
  }
}

export class OpenError extends Error {
  readonly #class = OpenError;
  readonly name = this.constructor.name;

  constructor(options: ErrorOptions) {
    super(`Could not open`, options);
  }

  static from(cause: unknown) {
    return new OpenError({ cause });
  }
}

export class TruncateError extends Error {
  readonly #class = TruncateError;
  readonly name = this.constructor.name;

  constructor(options: ErrorOptions) {
    super(`Could not truncate`, options);
  }

  static from(cause: unknown) {
    return new TruncateError({ cause });
  }
}

export class Circuit {
  readonly events = new SuperEventTarget<CloseEvents & ErrorEvents>();

  readonly #secret: SecretCircuit;

  constructor(secret: SecretCircuit) {
    this.#secret = secret;

    const onClose = this.#onClose.bind(this);
    this.#secret.events.on('close', onClose);

    const onError = this.#onError.bind(this);
    this.#secret.events.on('error', onError);
  }

  [Symbol.dispose]() {
    this.#secret[Symbol.dispose]();
  }

  async [Symbol.asyncDispose]() {
    this.#secret[Symbol.asyncDispose]();
  }

  get id() {
    return this.#secret.id;
  }

  get closed() {
    return Boolean(this.#secret.closed);
  }

  async #onClose() {
    return await this.events.emit('close', [undefined]);
  }

  async #onError(reason?: unknown) {
    return await this.events.emit('error', [reason]);
  }

  async extendOrThrow(
    microdesc: Consensus.Microdesc,
    signal = new AbortController().signal
  ) {
    return await this.#secret.extendOrThrow(microdesc, signal);
  }

  async openOrThrow(
    hostname: string,
    port: number,
    params?: CircuitOpenParams,
    signal = new AbortController().signal
  ) {
    return await this.#secret.openOrThrow(hostname, port, params, signal);
  }

  async openDirOrThrow(
    params?: CircuitOpenParams,
    signal = new AbortController().signal
  ) {
    return await this.#secret.openDirOrThrow(params, signal);
  }

  async close() {
    return await this.#secret.close();
  }
}

export type SecretCircuitEvents = CloseEvents &
  ErrorEvents & {
    /**
     * Streamless
     */
    RELAY_EXTENDED2: (
      cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>
    ) => void;
    RELAY_TRUNCATED: (cell: RelayCell.Streamless<RelayTruncatedCell>) => void;

    /**
     * Streamful
     */
    RELAY_CONNECTED: (cell: RelayCell.Streamful<Opaque>) => void;
    RELAY_DATA: (cell: RelayCell.Streamful<RelayDataCell<Opaque>>) => void;
    RELAY_END: (cell: RelayCell.Streamful<RelayEndCell>) => void;
  };

export class SecretCircuit {
  readonly #class = SecretCircuit;

  readonly events = new SuperEventTarget<SecretCircuitEvents>();

  readonly targets = new Array<Target>();
  readonly streams = new Map<number, SecretTorStreamDuplex>();

  #streamId = 1;

  #closed?: { reason?: unknown };

  #onClean: () => void;

  constructor(
    readonly id: number,
    readonly tor: SecretTorClientDuplex
  ) {
    const onClose = this.#onTorClose.bind(this);
    const onError = this.#onTorError.bind(this);

    const onDestroyCell = this.#onDestroyCell.bind(this);

    const onRelayExtended2Cell = this.#onRelayExtended2Cell.bind(this);
    const onRelayTruncatedCell = this.#onRelayTruncatedCell.bind(this);

    const onRelayConnectedCell = this.#onRelayConnectedCell.bind(this);
    const onRelayDataCell = this.#onRelayDataCell.bind(this);
    const onRelayEndCell = this.#onRelayEndCell.bind(this);

    this.tor.events.on('close', onClose, { passive: true });
    this.tor.events.on('error', onError, { passive: true });

    this.tor.events.on('DESTROY', onDestroyCell, { passive: true });

    this.tor.events.on('RELAY_EXTENDED2', onRelayExtended2Cell, {
      passive: true,
    });
    this.tor.events.on('RELAY_TRUNCATED', onRelayTruncatedCell, {
      passive: true,
    });

    this.tor.events.on('RELAY_CONNECTED', onRelayConnectedCell, {
      passive: true,
    });
    this.tor.events.on('RELAY_DATA', onRelayDataCell, { passive: true });
    this.tor.events.on('RELAY_END', onRelayEndCell, { passive: true });

    this.#onClean = () => {
      for (const stream of this.streams.values()) stream[Symbol.dispose]();

      this.tor.events.off('close', onClose);
      this.tor.events.off('error', onError);

      this.tor.events.off('DESTROY', onDestroyCell);

      this.tor.events.off('RELAY_EXTENDED2', onRelayExtended2Cell);
      this.tor.events.off('RELAY_TRUNCATED', onRelayTruncatedCell);

      this.tor.events.off('RELAY_CONNECTED', onRelayConnectedCell);
      this.tor.events.off('RELAY_DATA', onRelayDataCell);
      this.tor.events.off('RELAY_END', onRelayEndCell);

      this.tor.circuits.inner.delete(this.id);

      this.#onClean = () => {};
    };
  }

  [Symbol.dispose]() {
    // FIXME: Use Log instance for error reporting
    this.close().catch(() => {
      /* silent catch */
    });
  }

  async [Symbol.asyncDispose]() {
    await this.close();
  }

  get closed() {
    return this.#closed;
  }

  #onCloseOrError(reason?: unknown) {
    if (this.#closed) return;
    this.#closed = { reason };
    this.#onClean();
  }

  async close(reason: number = DestroyCell.reasons.NONE) {
    const error = new DestroyedError(reason);

    // TODO: send destroy cell

    this.#onCloseOrError(error);

    if (reason === DestroyCell.reasons.NONE)
      await this.events.emit('close', [error]);
    else await this.events.emit('error', [error]);
  }

  async #onTorClose() {
    Console.debug(`${this.constructor.name}.onTorClose`);

    this.#onCloseOrError();

    await this.events.emit('close', [undefined]);
  }

  async #onTorError(reason?: unknown) {
    Console.debug(`${this.constructor.name}.onReadError`, { reason });

    await this.events.emit('error', [reason]);

    this.#onCloseOrError(reason);
  }

  async #onDestroyCell(cell: Cell.Circuitful<DestroyCell>) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onDestroyCell`, cell);

    const error = new DestroyedError(cell.fragment.reason);

    this.#onCloseOrError(error);

    if (cell.fragment.reason === DestroyCell.reasons.NONE)
      await this.events.emit('close', [error]);
    else await this.events.emit('error', [error]);
  }

  async #onRelayExtended2Cell(
    cell: RelayCell.Streamless<RelayExtended2Cell<Opaque>>
  ) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onRelayExtended2Cell`, cell);

    await this.events.emit('RELAY_EXTENDED2', cell);
  }

  async #onRelayTruncatedCell(cell: RelayCell.Streamless<RelayTruncatedCell>) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onRelayTruncatedCell`, cell);

    const error = new DestroyedError(cell.fragment.reason);

    this.#onCloseOrError(error);

    if (cell.fragment.reason === RelayTruncateCell.reasons.NONE)
      await this.events.emit('close', [error]);
    else await this.events.emit('error', [error]);

    await this.events.emit('RELAY_TRUNCATED', cell);
  }

  async #onRelayConnectedCell(cell: RelayCell.Streamful<Opaque>) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onRelayConnectedCell`, cell);

    await this.events.emit('RELAY_CONNECTED', cell);
  }

  async #onRelayDataCell(cell: RelayCell.Streamful<RelayDataCell<Opaque>>) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onRelayDataCell`, cell);

    await this.events.emit('RELAY_DATA', cell);
  }

  async #onRelayEndCell(cell: RelayCell.Streamful<RelayEndCell>) {
    if (cell.circuit !== this) return;

    Console.debug(`${this.constructor.name}.onRelayEndCell`, cell);

    this.streams.delete(cell.stream.id);

    await this.events.emit('RELAY_END', cell);
  }

  async extendOrThrow(
    microdesc: Consensus.Microdesc,
    signal = new AbortController().signal
  ) {
    if (this.closed != null) throw this.closed.reason;

    using relayid_rsa_x = Base64.get()
      .getOrThrow()
      .decodeUnpaddedOrThrow(microdesc.identity);
    const relayid_rsa = Bytes.castOrThrow(
      relayid_rsa_x.bytes.slice(),
      HASH_LEN
    );

    using ntor_key_x = Base64.get()
      .getOrThrow()
      .decodeUnpaddedOrThrow(microdesc.ntorOnionKey);
    const ntor_key = Bytes.castOrThrow(ntor_key_x.bytes.slice(), 32);

    const relayid_ed = Option.wrap(microdesc.idEd25519)
      .mapSync(x => {
        using memory = Base64.get().getOrThrow().decodeUnpaddedOrThrow(x);
        return memory.bytes.slice();
      })
      .getOrNull();

    const links = new Array<RelayExtend2Link>();

    links.push(
      new RelayExtend2LinkIPv4(microdesc.hostname, Number(microdesc.orport))
    );

    if (microdesc.ipv6 != null)
      links.push(RelayExtend2LinkIPv6.from(microdesc.ipv6));

    links.push(new RelayExtend2LinkLegacyID(relayid_rsa));

    if (relayid_ed != null)
      links.push(new RelayExtend2LinkModernID(relayid_ed));

    using wasm_secret_x = await X25519.PrivateKey.randomOrThrow();
    using wasm_public_x = wasm_secret_x.getPublicKeyOrThrow();

    using public_x_memory = await wasm_public_x.exportOrThrow();

    const public_x = Bytes.castOrThrow(public_x_memory.bytes.slice(), 32);
    const public_b = ntor_key;

    const ntor_request = new Ntor.NtorRequest(public_x, relayid_rsa, public_b);
    const relay_extend2 = new RelayExtend2Cell(
      RelayExtend2Cell.types.NTOR,
      links,
      ntor_request
    );
    const relay_early_cell = RelayEarlyCell.Streamless.from(
      this,
      undefined,
      relay_extend2
    );
    this.tor.output.enqueue(relay_early_cell.cellOrThrow());

    const msg_extended2 = await Plume.waitWithCloseAndErrorOrThrow(
      this.events,
      'RELAY_EXTENDED2',
      (future: Future<RelayCell.Streamless<RelayExtended2Cell<Opaque>>>, e) => {
        future.resolve(e);
      },
      signal
    );

    const response = msg_extended2.fragment.fragment.readIntoOrThrow(
      Ntor.NtorResponse
    );

    const { public_y } = response;

    using wasm_public_y = await X25519.PublicKey.importOrThrow(public_y);
    using wasm_public_b = await X25519.PublicKey.importOrThrow(public_b);

    using wasm_shared_xy = await wasm_secret_x.computeOrThrow(wasm_public_y);
    using wasm_shared_xb = await wasm_secret_x.computeOrThrow(wasm_public_b);

    using shared_xy_memory = wasm_shared_xy.exportOrThrow();
    using shared_xb_memory = wasm_shared_xb.exportOrThrow();

    const shared_xy = Bytes.castOrThrow(shared_xy_memory.bytes.slice(), 32);
    const shared_xb = Bytes.castOrThrow(shared_xb_memory.bytes.slice(), 32);

    const result = await NtorResult.finalizeOrThrow(
      shared_xy,
      shared_xb,
      relayid_rsa,
      public_b,
      public_x,
      public_y
    );

    if (!Bytes.equals(response.auth, result.auth))
      throw new InvalidNtorAuthError();

    const forward_digest = await Sha1Hasher.createOrThrow();
    const backward_digest = await Sha1Hasher.createOrThrow();

    await forward_digest.updateOrThrow(result.forwardDigest);
    await backward_digest.updateOrThrow(result.backwardDigest);

    const forwardKey = new VerifiedAes128Ctr(
      result.forwardKey,
      new Uint8Array(16)
    );
    const backwardKey = new VerifiedAes128Ctr(
      result.backwardKey,
      new Uint8Array(16)
    );

    const target = new Target(
      relayid_rsa,
      this,
      forward_digest,
      backward_digest,
      forwardKey,
      backwardKey
    );

    this.targets.push(target);
  }

  async truncateOrThrow(
    reason: number = RelayTruncateCell.reasons.NONE,
    signal = new AbortController().signal
  ) {
    if (this.closed != null) throw this.closed.reason;

    const relay_truncate = new RelayTruncateCell(reason);
    const relay_truncate_cell = RelayCell.Streamless.from(
      this,
      undefined,
      relay_truncate
    );
    const cell = relay_truncate_cell.cellOrThrow();
    this.tor.output.enqueue(cell);

    await Plume.waitWithCloseAndErrorOrThrow(
      this.events,
      'RELAY_TRUNCATED',
      (future: Future<RelayCell.Streamless<RelayTruncatedCell>>, e) => {
        future.resolve(e);
      },
      signal
    );
  }

  async openDirOrThrow(
    params: CircuitOpenParams = {},
    signal = new AbortController().signal
  ) {
    if (this.closed != null) throw this.closed.reason;

    const stream = new SecretTorStreamDuplex(
      'directory',
      this.#streamId++,
      this
    );

    invariant(
      stream.id > 0 && stream.id < 65536,
      `Stream ID must be in valid range (1-65535), got ${stream.id}`
    );
    invariant(
      !this.streams.has(stream.id),
      `Stream ID must be unique, but ${stream.id} already exists in circuit`
    );

    this.streams.set(stream.id, stream);

    const begin = new RelayBeginDirCell();
    const begin_cell = RelayCell.Streamful.from(this, stream, begin);
    const cell = begin_cell.cellOrThrow();
    this.tor.output.enqueue(cell);

    if (!params.wait) return new TorStreamDuplex(stream);

    await Plume.waitWithCloseAndErrorOrThrow(
      stream.events,
      'connected',
      (future: Future<void>) => {
        future.resolve();
      },
      signal
    );

    return new TorStreamDuplex(stream);
  }

  async openOrThrow(
    hostname: string,
    port: number,
    params: CircuitOpenParams = {},
    signal = new AbortController().signal
  ) {
    if (this.closed != null) throw this.closed.reason;

    const { ipv6 = 'preferred' } = params;

    const stream = new SecretTorStreamDuplex(
      'external',
      this.#streamId++,
      this
    );

    invariant(
      stream.id > 0 && stream.id < 65536,
      `Stream ID must be in valid range (1-65535), got ${stream.id}`
    );
    invariant(
      !this.streams.has(stream.id),
      `Stream ID must be unique, but ${stream.id} already exists in circuit`
    );

    this.streams.set(stream.id, stream);

    const flags = new Bitset(0, 32)
      .setLE(RelayBeginCell.flags.IPV6_OK, IPv6[ipv6] !== IPv6.never)
      .setLE(RelayBeginCell.flags.IPV4_NOT_OK, IPv6[ipv6] === IPv6.always)
      .setLE(RelayBeginCell.flags.IPV6_PREFER, IPv6[ipv6] > IPv6.avoided)
      .unsign().value;

    const begin = RelayBeginCell.create(`${hostname}:${port}`, flags);
    const begin_cell = RelayCell.Streamful.from(this, stream, begin);
    const cell = begin_cell.cellOrThrow();
    this.tor.output.enqueue(cell);

    if (!params.wait) return new TorStreamDuplex(stream);

    await Plume.waitWithCloseAndErrorOrThrow(
      stream.events,
      'connected',
      (future: Future<void>) => {
        future.resolve();
      },
      signal
    );

    return new TorStreamDuplex(stream);
  }
}
