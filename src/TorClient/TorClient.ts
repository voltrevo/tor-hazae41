import '@hazae41/symbol-dispose-polyfill';
import './bufferPolyfill';

import { Ciphers, TlsClientDuplex } from '@hazae41/cadenas';
import {
  Circuit,
  Echalote,
  TorClientDuplex,
  createSnowflakeStream,
} from '../echalote';
import { fetch } from '../fleche';

import { WebSocketDuplex } from './WebSocketDuplex';
import { createAutoStorage, IStorage } from 'tor-hazae41/storage';
import { ConsensusManager } from './ConsensusManager';
import { CircuitManager } from './CircuitManager';
import { getErrorDetails } from '../utils/getErrorDetails';
import { Log } from '../Log';

/**
 * Configuration options for the TorClient.
 */
export interface TorClientOptions {
  /** The Snowflake bridge WebSocket URL for Tor connections */
  snowflakeUrl: string;
  /** Timeout in milliseconds for establishing initial connections (default: 15000) */
  connectionTimeout?: number;
  /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
  circuitTimeout?: number;
  /** Whether to create the first circuit immediately upon construction (default: true) */
  createCircuitEarly?: boolean;
  /** Interval in milliseconds between automatic circuit updates, or null to disable (default: 600000 = 10 minutes) */
  circuitUpdateInterval?: number | null;
  /** Time in milliseconds to allow old circuit usage before forcing new circuit during updates (default: 60000 = 1 minute) */
  circuitUpdateAdvance?: number;
  /** Optional logger instance for hierarchical logging */
  log?: Log;
  /** Storage interface */
  storage?: IStorage;
}

/**
 * A Tor client that provides secure, anonymous HTTP/HTTPS requests through the Tor network.
 *
 * Features:
 * - Automatic circuit creation and updates
 * - Persistent connections for multiple requests
 * - Graceful circuit transitions with configurable deadlines
 * - Support for both HTTP and HTTPS requests
 * - Comprehensive logging and status monitoring
 * - Resource cleanup and disposal
 *
 * @example
 * ```typescript
 * const client = new TorClient({
 *   snowflakeUrl: 'wss://snowflake.torproject.net/',
 *   onLog: (msg, type) => console.log(`[${type}] ${msg}`)
 * });
 *
 * const response = await client.fetch('https://httpbin.org/ip');
 * const data = await response.json();
 * console.log('My Tor IP:', data.origin);
 *
 * client.dispose(); // Clean up when done
 * ```
 */
export class TorClient {
  private snowflakeUrl: string;
  private connectionTimeout: number;
  private circuitTimeout: number;
  private createCircuitEarly: boolean;
  private circuitUpdateInterval: number | null;
  private circuitUpdateAdvance: number;
  private log: Log;
  private storage: IStorage;

  // Consensus management
  private consensusManager: ConsensusManager;

  // Circuit management
  private circuitManager: CircuitManager;

  /**
   * Creates a new TorClient instance with the specified configuration.
   *
   * @example
   * ```typescript
   * const client = new TorClient({
   *   snowflakeUrl: 'wss://snowflake.torproject.net/',
   *   log: new Log()
   * });
   *
   * const response = await client.fetch('https://httpbin.org/ip');
   * const data = await response.json();
   * console.log('My Tor IP:', data.origin);
   *
   * client.dispose(); // Clean up when done
   * ```
   */
  constructor(options: TorClientOptions) {
    this.snowflakeUrl = options.snowflakeUrl;
    this.connectionTimeout = options.connectionTimeout ?? 15000;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.createCircuitEarly = options.createCircuitEarly ?? true;
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000; // 10 minutes
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000; // 1 minute
    this.log = options.log ?? new Log();
    this.storage = options.storage ?? createAutoStorage('tor-hazae41-cache');
    this.consensusManager = new ConsensusManager({
      storage: this.storage,
      log: this.log.child('consensus'),
    });

    // Initialize circuit manager
    this.circuitManager = new CircuitManager({
      circuitTimeout: this.circuitTimeout,
      circuitUpdateInterval: this.circuitUpdateInterval,
      circuitUpdateAdvance: this.circuitUpdateAdvance,
      log: this.log.child('circuit'),
      createTorConnection: () => this.createTorConnection(),
      getConsensus: circuit => this.consensusManager.getConsensus(circuit),
    });

    // Create first circuit immediately if requested
    if (this.createCircuitEarly) {
      this.circuitManager.getOrCreateCircuit().catch(error => {
        this.log.error(
          `Failed to create initial circuit: ${getErrorDetails(error)}`
        );
      });
    }

    // Note: Circuit updates are scheduled only after first use to avoid
    // unnecessary circuit creation during periods of inactivity
  }

  /**
   * Makes a one-time fetch request through Tor with a temporary circuit.
   * Creates a new TorClient with no auto-updates, makes the request, and
   * disposes of the circuit. This is ideal for single requests where you
   * don't need persistent circuit management.
   *
   * The circuit is created specifically for this request and disposed
   * immediately after completion, providing maximum isolation but less
   * efficiency for multiple requests.
   *
   * @param snowflakeUrl The Snowflake bridge WebSocket URL
   * @param url The URL to fetch
   * @param options Optional fetch options and TorClient configuration
   * @returns Promise resolving to the fetch Response
   */
  static async fetch(
    snowflakeUrl: string,
    url: string,
    options?: RequestInit & {
      connectionTimeout?: number;
      circuitTimeout?: number;
      log?: Log;
    }
  ): Promise<Response> {
    const { connectionTimeout, circuitTimeout, log, ...fetchOptions } =
      options || {};

    const client = new TorClient({
      snowflakeUrl,
      connectionTimeout,
      circuitTimeout,
      log,
      createCircuitEarly: false, // Don't create circuit until needed
      circuitUpdateInterval: null, // No auto-updates for one-time use
      circuitUpdateAdvance: 0, // Not relevant for one-time use
    });

    try {
      return await client.fetch(url, fetchOptions);
    } finally {
      client.close();
    }
  }

  /**
   * Makes a fetch request through Tor using this client's persistent circuit.
   * The circuit is reused across multiple requests and automatically updated
   * based on the configured update interval and advance settings.
   *
   * Use this method when you have multiple requests or want to maintain
   * a long-lived Tor connection with automatic circuit management.
   *
   * @param url The URL to fetch
   * @param options Optional fetch options
   * @returns Promise resolving to the fetch Response
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    this.logMessage(`Starting fetch request to ${url}`);

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : parsedUrl.protocol === 'https:'
        ? 443
        : 80;
    const isHttps = parsedUrl.protocol === 'https:';

    this.logMessage(`Target: ${hostname}:${port} (HTTPS: ${isHttps})`);

    try {
      const circuit = await this.circuitManager.getOrCreateCircuit();

      // Mark circuit as used to schedule updates
      this.circuitManager.markCircuitUsed();

      this.logMessage(`Opening connection to ${hostname}:${port}`);
      const ttcp = await circuit.openOrThrow(hostname, port);

      if (isHttps) {
        this.logMessage('Setting up TLS connection');
        const ciphers = [
          Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
          Ciphers.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
        ];
        const ttls = new TlsClientDuplex({ host_name: hostname, ciphers });

        // Connect TLS streams
        ttcp.outer.readable.pipeTo(ttls.inner.writable).catch(() => {});
        ttls.inner.readable.pipeTo(ttcp.outer.writable).catch(() => {});

        this.logMessage('Making HTTPS request through Tor');
        const response = await fetch(url, {
          ...options,
          stream: ttls.outer,
        });

        this.logMessage('Request completed successfully', 'success');
        return response;
      } else {
        this.logMessage('Making HTTP request through Tor');
        const response = await fetch(url, {
          ...options,
          stream: ttcp.outer,
        });

        this.logMessage('Request completed successfully', 'success');
        return response;
      }
    } catch (error) {
      this.logMessage(`Request failed: ${(error as Error).message}`, 'error');

      // If circuit fails, clear it so next request will create a new one
      this.circuitManager.clearCircuit();

      throw error;
    }
  }

  /**
   * Updates the circuit with a deadline for graceful transition.
   * @param deadline Milliseconds to allow existing requests to use the old circuit. Defaults to 0.
   */
  async updateCircuit(deadline: number = 0): Promise<void> {
    await this.circuitManager.updateCircuit(deadline);
  }

  /**
   * Waits for a circuit to be ready if one would be needed for requests.
   */
  async waitForCircuit(): Promise<void> {
    await this.circuitManager.getOrCreateCircuit();
  }

  /**
   * Gets the current circuit status information.
   * @returns Object containing circuit state, update status, and timing information
   */
  getCircuitStatus() {
    return this.circuitManager.getCircuitStatus();
  }

  /**
   * Gets a human-readable status string for the current circuit state.
   */
  getCircuitStatusString(): string {
    return this.circuitManager.getCircuitStatusString();
  }

  /**
   * Closes the TorClient, cleaning up resources.
   */
  close(): void {
    // Close the consensus manager
    this.consensusManager.close();

    // Close the circuit manager
    this.circuitManager.close();
  }

  /**
   * Symbol.dispose implementation for automatic resource cleanup.
   * Calls close() to clean up all resources.
   */
  [Symbol.dispose](): void {
    this.close();
  }

  private logMessage(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    switch (type) {
      case 'error':
        this.log.error(message);
        break;
      case 'success':
      case 'info':
        this.log.info(message);
        break;
    }
  }

  private logError(
    prefix: string,
    error: unknown,
    defaultMessage: string
  ): void {
    const errorMessage = getErrorDetails(error) || defaultMessage;
    this.logMessage(`${prefix}: ${errorMessage}`, 'error');
  }

  private async createTorConnection(): Promise<TorClientDuplex> {
    this.logMessage(`Connecting to Snowflake bridge at ${this.snowflakeUrl}`);

    const stream = await WebSocketDuplex.connect(
      this.snowflakeUrl,
      AbortSignal.timeout(this.connectionTimeout)
    );

    this.logMessage('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    const tor = new TorClientDuplex();

    this.logMessage('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      this.logError('TCP -> Tor stream error', error, 'Stream pipe error');
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      this.logError('Tor -> TCP stream error', error, 'Stream pipe error');
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      this.logError('Tor client error', error, 'Unknown error');
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      // Only log as error if there's an actual error reason
      const logLevel = reason && reason !== undefined ? 'error' : 'info';
      this.logMessage(`Tor client closed: ${reasonMessage}`, logLevel);
    });

    this.logMessage(
      `Waiting for Tor to be ready (timeout: ${this.circuitTimeout}ms)`
    );
    await tor.waitOrThrow(AbortSignal.timeout(this.circuitTimeout));
    this.logMessage('Tor client ready!', 'success');

    return tor;
  }

  /**
   * Extends a circuit through a randomly selected relay.
   * NOTE: Since circuit.extendOrThrow destroys the circuit on failure,
   * this function will dispose the circuit and throw if extension fails.
   *
   * @param circuit The circuit to extend (will be disposed on failure)
   * @param candidates Array of microdesc candidates to choose from
   * @param logPrefix Prefix for log messages (e.g., "middle relay" or "exit relay")
   * @param timeout Timeout in milliseconds for the extension attempt (default: 10000)
   * @throws Error if extension fails (circuit will be disposed)
   */
  private async extendCircuit(
    circuit: Circuit,
    candidates: Echalote.Consensus.Microdesc.Head[],
    logPrefix: string,
    timeout: number = 10000
  ): Promise<void> {
    if (candidates.length === 0) {
      throw new Error(`No ${logPrefix} candidates available`);
    }

    // Pick a random candidate
    const candidate = candidates[Math.floor(Math.random() * candidates.length)];

    try {
      this.logMessage(`Extending circuit through ${logPrefix}`);
      const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
        circuit,
        candidate
      );
      await circuit.extendOrThrow(microdesc, AbortSignal.timeout(timeout));
      this.logMessage(`Extended through ${logPrefix}`, 'success');
    } catch (e) {
      // Circuit is now destroyed, dispose it
      circuit[Symbol.dispose]();
      throw e;
    }
  }

  private async createCircuit(tor: TorClientDuplex): Promise<Circuit> {
    this.logMessage('Creating circuits');
    const consensusCircuit = await tor.createOrThrow();
    this.logMessage('Consensus circuit created successfully', 'success');

    // Get consensus (from cache if fresh, or fetch if needed)
    const consensus =
      await this.consensusManager.getConsensus(consensusCircuit);

    this.logMessage('Filtering relays');
    const middles = consensus.microdescs.filter(
      it =>
        it.flags.includes('Fast') &&
        it.flags.includes('Stable') &&
        it.flags.includes('V2Dir')
    );

    const exits = consensus.microdescs.filter(
      it =>
        it.flags.includes('Fast') &&
        it.flags.includes('Stable') &&
        it.flags.includes('Exit') &&
        !it.flags.includes('BadExit')
    );

    this.logMessage(
      `Found ${middles.length} middle relays and ${exits.length} exit relays`
    );

    if (middles.length === 0 || exits.length === 0) {
      throw new Error('Not enough suitable relays found');
    }

    // Attempt to build a complete circuit with retry logic
    // Since extendOrThrow destroys the circuit on failure, we need to
    // create a fresh circuit for each complete attempt
    const maxCircuitAttempts = 10;
    let lastError: unknown;

    for (
      let circuitAttempt = 1;
      circuitAttempt <= maxCircuitAttempts;
      circuitAttempt++
    ) {
      try {
        this.logMessage(
          `Building circuit (attempt ${circuitAttempt}/${maxCircuitAttempts})`
        );
        const circuit = await tor.createOrThrow();

        for (let i = 1; i <= 1; i++) {
          const suffix = i === 1 ? '' : ` (${i})`;

          // Try to extend through middle relay
          await this.extendCircuit(circuit, middles, `middle relay${suffix}`);
        }

        // Try to extend through exit relay
        await this.extendCircuit(circuit, exits, 'exit relay');

        this.logMessage('Circuit built successfully!', 'success');
        return circuit;
      } catch (e) {
        lastError = e;
        // Only log details on final attempt
        if (circuitAttempt === maxCircuitAttempts) {
          this.logMessage(
            `Circuit build failed after ${maxCircuitAttempts} attempts: ${getErrorDetails(e)}`,
            'error'
          );
        }
      }
    }

    throw new Error(
      `Failed to build circuit after ${maxCircuitAttempts} attempts. Last error: ${getErrorDetails(lastError)}`
    );
  }
}
