import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { Log } from '../Log';
import { selectRandomElement } from '../utils/random';
import { isMiddleRelay, isExitRelay } from '../utils/relayFilters';
import { getErrorDetails } from '../utils/getErrorDetails';
import { initWasm } from './initWasm';
import { EventEmitter } from './EventEmitter';

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
  private readonly torConnection: TorClientDuplex;
  private readonly getConsensus: (
    circuit: Circuit
  ) => Promise<Echalote.Consensus>;
  private readonly log: Log;
  private readonly maxAttempts: number;
  private readonly extendTimeout: number;

  /**
   * Creates a new circuit builder instance.
   *
   * @param torConnection Tor connection to build circuits through
   * @param getConsensus Function to fetch consensus information
   * @param log Logger instance
   * @param maxAttempts Maximum build attempts per circuit (default: 10)
   * @param extendTimeout Timeout for circuit extension in milliseconds (default: 10000)
   */
  constructor(
    torConnection: TorClientDuplex,
    getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>,
    log: Log,
    maxAttempts: number = 10,
    extendTimeout: number = 10000
  ) {
    super();
    this.torConnection = torConnection;
    this.getConsensus = getConsensus;
    this.log = log;
    this.maxAttempts = maxAttempts;
    this.extendTimeout = extendTimeout;
  }

  /**
   * Builds a new circuit through the Tor network.
   * Selects random middle relays and extends through either a random exit relay or a pre-determined final hop.
   *
   * @param finalHop Optional pre-determined final hop relay. When provided, this relay is used as the final hop
   *                 instead of selecting a random exit relay. Used internally by CircuitManager for keynet circuits.
   * @throws Error if circuit building fails after all retry attempts
   */
  async buildCircuit(
    finalHop?: Echalote.Consensus.Microdesc
  ): Promise<Circuit> {
    await initWasm();

    this.log.info('[CircuitBuilder] Creating circuit');

    // Create consensus circuit and fetch consensus
    const consensusCircuit = await this.torConnection.createOrThrow();
    this.log.info('[CircuitBuilder] Consensus circuit created');

    try {
      return await this.buildCircuitWithRetries(consensusCircuit, finalHop);
    } finally {
      // Dispose consensus circuit
      this.disposeCircuit(consensusCircuit);
    }
  }

  /**
   * Attempts to build a circuit with retry logic.
   * Extracted from buildCircuit() to reduce nesting complexity.
   *
   * @param consensusCircuit Circuit to use for fetching consensus
   * @param finalHop Optional pre-determined final hop
   * @throws Error if circuit building fails after all retry attempts
   */
  private async buildCircuitWithRetries(
    consensusCircuit: Circuit,
    finalHop?: Echalote.Consensus.Microdesc
  ): Promise<Circuit> {
    const consensus = await this.getConsensus(consensusCircuit);

    // Select relay candidates
    const middles = consensus.microdescs.filter(isMiddleRelay);
    const exits = finalHop
      ? undefined
      : consensus.microdescs.filter(isExitRelay);

    this.log.info(
      `[CircuitBuilder] Found ${middles.length} middle relays${exits ? ` and ${exits.length} exit relays` : ''}`
    );

    if (middles.length === 0) {
      throw new Error(`Insufficient relays: ${middles.length} middles`);
    }

    if (!finalHop && exits && exits.length === 0) {
      throw new Error('Insufficient relays: 0 exits');
    }

    // Try building circuit with retries
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.attemptBuildCircuit(
          middles,
          exits,
          finalHop,
          attempt
        );
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

  /**
   * Single attempt to build a circuit.
   * Extracted from buildCircuit() to reduce nesting complexity.
   *
   * @param middles Middle relay candidates
   * @param exits Exit relay candidates (undefined if using finalHop)
   * @param finalHop Optional pre-determined final hop
   * @param attempt Current attempt number
   * @throws Error if this attempt fails
   */
  private async attemptBuildCircuit(
    middles: Echalote.Consensus.Microdesc.Head[],
    exits: Echalote.Consensus.Microdesc.Head[] | undefined,
    finalHop: Echalote.Consensus.Microdesc | undefined,
    attempt: number
  ): Promise<Circuit> {
    this.log.info(
      `[CircuitBuilder] Building circuit (attempt ${attempt}/${this.maxAttempts})`
    );

    const newCircuit = await this.torConnection.createOrThrow();

    try {
      // Extend through middle relay
      await this.extendCircuit(newCircuit, middles, 'middle');

      // Extend through final hop (exit relay or keynet node)
      if (finalHop) {
        await this.extendCircuitThroughRelay(newCircuit, finalHop, 'final hop');
      } else {
        await this.extendCircuit(newCircuit, exits!, 'exit');
      }

      this.log.info('[CircuitBuilder] Circuit built successfully');
      this.emit('circuit-created', newCircuit);
      return newCircuit;
    } catch (e) {
      // Dispose failed circuit
      this.disposeCircuit(newCircuit);
      throw e;
    }
  }

  /**
   * Safely disposes a circuit with proper error handling and logging.
   *
   * @param circuit The circuit to dispose
   */
  private disposeCircuit(circuit: Circuit): void {
    try {
      (circuit as unknown as Disposable)[Symbol.dispose]();
    } catch (e) {
      this.log.error(
        `[CircuitBuilder] Error disposing circuit: ${getErrorDetails(e)}`
      );
    }
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
      const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
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

  /**
   * Extends a circuit through a specific relay (already fetched).
   * Used for extending through keynet exit nodes or other pre-determined relays.
   *
   * @throws Error if extension fails
   */
  private async extendCircuitThroughRelay(
    circuit: Circuit,
    microdesc: Echalote.Consensus.Microdesc,
    relayType: string
  ): Promise<void> {
    this.log.info(`[CircuitBuilder] Extending through ${relayType}`);

    try {
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
