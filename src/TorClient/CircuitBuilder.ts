import { Circuit, Consensus, Echalote, TorClientDuplex } from '../echalote';
import { Log } from '../Log';
import { selectRandomElement } from '../utils/random';
import { isMiddleRelay, isExitRelay } from '../utils/relayFilters';
import { getErrorDetails } from '../utils/getErrorDetails';
import { initWasm } from './initWasm';
import { EventEmitter } from './EventEmitter';
import { decodeKeynetPubKey } from '../keynet/decodeKeynetPubkey';
import { MicrodescManager } from './MicrodescManager';

/**
 * Events emitted by CircuitBuilder.
 */
export type CircuitBuilderEvents = {
  'circuit-created': (circuit: Circuit) => void;
  'circuit-failed': (
    error: Error,
    attempt: number,
    maxAttempts: number
  ) => void;
  'relay-selected': (relayType: string) => void;
  'relay-extended': (relayType: string) => void;
};

/**
 * Builds individual circuits through the Tor network.
 * Handles relay selection, circuit extension, and retry logic.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class CircuitBuilder extends EventEmitter<CircuitBuilderEvents> {
  /**
   * Creates a new circuit builder instance.
   *
   * @param torConnection Tor connection to build circuits through
   * @param getConsensus Function to fetch consensus information
   * @param log Logger instance
   * @param microdescManager Manager for caching microdescs
   * @param maxAttempts Maximum build attempts per circuit (default: 10)
   * @param extendTimeout Timeout for circuit extension in milliseconds (default: 10000)
   */
  constructor(
    private readonly torConnection: TorClientDuplex,
    private readonly getConsensus: (
      circuit: Circuit
    ) => Promise<Echalote.Consensus>,
    private readonly log: Log,
    private readonly microdescManager: MicrodescManager,
    private readonly maxAttempts: number = 10,
    private readonly extendTimeout: number = 10000
  ) {
    super();
  }

  /**
   * Builds a new circuit through the Tor network.
   * Selects random middle and exit relays, extends circuit through them.
   *
   * @throws Error if circuit building fails after all retry attempts
   */
  async buildCircuit(hostname?: string): Promise<Circuit> {
    if (hostname?.endsWith('.keynet')) {
      return await this.buildKeynetCircuit(hostname);
    }

    await initWasm();

    this.log.info('[CircuitBuilder] Creating circuit');

    // Create consensus circuit and fetch consensus
    const consensusCircuit = await this.torConnection.createOrThrow();
    this.log.info('[CircuitBuilder] Consensus circuit created');

    try {
      const consensus = await this.getConsensus(consensusCircuit);

      // Select relay candidates
      const middles = consensus.microdescs.filter(isMiddleRelay);
      const exits = consensus.microdescs.filter(isExitRelay);

      this.log.info(
        `[CircuitBuilder] Found ${middles.length} middle and ${exits.length} exit relays`
      );

      if (middles.length === 0 || exits.length === 0) {
        throw new Error(
          `Insufficient relays: ${middles.length} middles, ${exits.length} exits`
        );
      }

      // Try building circuit with retries
      let lastError: unknown;

      for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
        try {
          this.log.info(
            `[CircuitBuilder] Building circuit (attempt ${attempt}/${this.maxAttempts})`
          );

          const circuit = await this.torConnection.createOrThrow();

          try {
            // Extend through middle relay
            await this.extendCircuit(circuit, middles, 'middle');

            // Extend through exit relay
            await this.extendCircuit(circuit, exits, 'exit');

            this.log.info('[CircuitBuilder] Circuit built successfully');
            this.emit('circuit-created', circuit);
            return circuit;
          } catch (e) {
            // Dispose failed circuit
            try {
              (circuit as unknown as Disposable)[Symbol.dispose]();
            } catch {
              // Ignore disposal errors
            }
            throw e;
          }
        } catch (e) {
          lastError = e;
          const error = e instanceof Error ? e : new Error(String(e));
          this.emit('circuit-failed', error, attempt, this.maxAttempts);

          if (attempt === this.maxAttempts) {
            this.log.error(
              `[CircuitBuilder] Failed after ${this.maxAttempts} attempts: ${getErrorDetails(e)}`
            );
          }
        }
      }

      throw new Error(
        `Circuit build failed after ${this.maxAttempts} attempts: ${getErrorDetails(lastError)}`
      );
    } finally {
      // Dispose consensus circuit
      try {
        (consensusCircuit as unknown as Disposable)[Symbol.dispose]();
      } catch {
        // Ignore disposal errors
      }
    }
  }

  async buildKeynetCircuit(hostname: string): Promise<Circuit> {
    await initWasm();

    this.log.info('[CircuitBuilder] Creating keynet circuit');

    // Create consensus circuit and fetch consensus
    const consensusCircuit = await this.torConnection.createOrThrow();
    this.log.info('[CircuitBuilder] Consensus circuit created');

    let consensus;

    try {
      consensus = await this.getConsensus(consensusCircuit);
    } catch (e) {
      consensusCircuit[Symbol.dispose]();
      throw e;
    }

    // Select relay candidates
    const middles = consensus.microdescs.filter(isMiddleRelay);

    this.log.info(`[CircuitBuilder] Found ${middles.length} middle relays`);

    if (middles.length === 0) {
      throw new Error(`Insufficient relays: ${middles.length} middles`);
    }

    // Try building circuit with retries
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        this.log.info(
          `[CircuitBuilder] Building keynet circuit (attempt ${attempt}/${this.maxAttempts})`
        );

        const circuit = await this.torConnection.createOrThrow();

        try {
          // Extend through middle relay
          await this.extendCircuit(circuit, middles, 'middle');

          // Extend through another middle relay
          await this.extendCircuit(circuit, middles, 'middle (2)');

          await this.extendCircuitToKeynet(consensus, circuit, hostname);

          this.log.info('[CircuitBuilder] Keynet circuit built successfully');
          this.emit('circuit-created', circuit);
          return circuit;
        } catch (e) {
          // Dispose failed circuit
          circuit[Symbol.dispose]();
          throw e;
        }
      } catch (e) {
        lastError = e;
        const error = e instanceof Error ? e : new Error(String(e));
        this.emit('circuit-failed', error, attempt, this.maxAttempts);

        if (attempt === this.maxAttempts) {
          this.log.error(
            `[CircuitBuilder] Failed after ${this.maxAttempts} attempts: ${getErrorDetails(e)}`
          );
        }
      }
    }

    throw new Error(
      `Circuit build failed after ${this.maxAttempts} attempts: ${getErrorDetails(lastError)}`
    );
  }

  async extendCircuitToKeynet(
    consensus: Consensus,
    circuit: Circuit,
    hostname: string
  ) {
    const pubkey = await decodeKeynetPubKey(hostname);

    const candidates = consensus.microdescs.filter(
      // keynet servers choose an rsa key such that the first byte of their rsa
      // fingerprint (m.identity) matches the first byte of their ed25519 key
      // (pubkey).
      m => Buffer.from(m.identity, 'base64')[0] === pubkey[0]
    );

    const fullCandidates = await this.microdescManager.getMicrodescs(
      circuit,
      candidates
    );

    let keynetNode: Consensus.Microdesc | undefined;

    for (const candidate of fullCandidates) {
      if (
        Buffer.from(candidate.idEd25519, 'base64').equals(Buffer.from(pubkey))
      ) {
        keynetNode = candidate;
        break;
      }
    }

    if (!keynetNode) {
      throw new Error('Failed to find keynet exit node');
    }

    await circuit.extendOrThrow(
      keynetNode,
      AbortSignal.timeout(this.extendTimeout)
    );
  }

  /**
   * Extends a circuit through a randomly selected relay.
   *
   * @throws Error if extension fails
   */
  private async extendCircuit(
    circuit: Circuit,
    candidates: Echalote.Consensus.Microdesc.Head[],
    relayType: string
  ): Promise<void> {
    if (candidates.length === 0) {
      throw new Error(`No ${relayType} relay candidates available`);
    }

    const candidate = selectRandomElement(candidates);
    this.emit('relay-selected', relayType);

    this.log.info(`[CircuitBuilder] Extending through ${relayType} relay`);

    try {
      const microdesc = await this.microdescManager.getMicrodesc(
        circuit,
        candidate
      );
      await circuit.extendOrThrow(
        microdesc,
        AbortSignal.timeout(this.extendTimeout)
      );
      this.log.info(`[CircuitBuilder] Extended through ${relayType}`);
      this.emit('relay-extended', relayType);
    } catch (e) {
      this.log.error(
        `[CircuitBuilder] Extension through ${relayType} failed: ${getErrorDetails(e)}`
      );
      throw e;
    }
  }
}
