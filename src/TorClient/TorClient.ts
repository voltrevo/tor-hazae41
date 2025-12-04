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
import { initWasm } from './initWasm';
import { createAutoStorage, IStorage } from 'tor-hazae41/storage';
import { ConsensusManager } from './ConsensusManager';

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
  /** Optional logging callback function */
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
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
  private onLog?: (
    message: string,
    type?: 'info' | 'success' | 'error'
  ) => void;
  private storage: IStorage;

  // Circuit state management
  private currentTor?: TorClientDuplex;
  private currentCircuit?: Circuit;
  private circuitPromise?: Promise<Circuit>;
  private isUpdatingCircuit = false;
  private updateDeadline = 0;
  private updateTimer?: NodeJS.Timeout;
  private updateLoopActive = false;
  private nextUpdateTime = 0;
  private circuitUsed = false;

  // Consensus management
  private consensusManager: ConsensusManager;

  /**
   * Creates a new TorClient instance with the specified configuration.
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
  constructor(options: TorClientOptions) {
    this.snowflakeUrl = options.snowflakeUrl;
    this.connectionTimeout = options.connectionTimeout ?? 15000;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.createCircuitEarly = options.createCircuitEarly ?? true;
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000; // 10 minutes
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000; // 1 minute
    this.onLog = options.onLog;
    this.storage = options.storage ?? createAutoStorage('tor-hazae41-cache');
    this.consensusManager = new ConsensusManager({
      storage: this.storage,
      onLog: this.onLog,
    });

    // Create first circuit immediately if requested
    if (this.createCircuitEarly) {
      this.getOrCreateCircuit().catch(error => {
        this.log(`Failed to create initial circuit: ${error.message}`, 'error');
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
      onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
    }
  ): Promise<Response> {
    const { connectionTimeout, circuitTimeout, onLog, ...fetchOptions } =
      options || {};

    const client = new TorClient({
      snowflakeUrl,
      connectionTimeout,
      circuitTimeout,
      onLog,
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
    this.log(`Starting fetch request to ${url}`);

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port)
      : parsedUrl.protocol === 'https:'
        ? 443
        : 80;
    const isHttps = parsedUrl.protocol === 'https:';

    this.log(`Target: ${hostname}:${port} (HTTPS: ${isHttps})`);

    try {
      const circuit = await this.getOrCreateCircuit();

      // Schedule circuit updates on first use
      if (!this.circuitUsed) {
        this.circuitUsed = true;
        this.scheduleCircuitUpdate();
        this.log('Circuit used for first time, scheduling automatic updates');
      }

      this.log(`Opening connection to ${hostname}:${port}`);
      const ttcp = await circuit.openOrThrow(hostname, port);

      if (isHttps) {
        this.log('Setting up TLS connection');
        const ciphers = [
          Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
          Ciphers.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
        ];
        const ttls = new TlsClientDuplex({ host_name: hostname, ciphers });

        // Connect TLS streams
        ttcp.outer.readable.pipeTo(ttls.inner.writable).catch(() => {});
        ttls.inner.readable.pipeTo(ttcp.outer.writable).catch(() => {});

        this.log('Making HTTPS request through Tor');
        const response = await fetch(url, {
          ...options,
          stream: ttls.outer,
        });

        this.log('Request completed successfully', 'success');
        return response;
      } else {
        this.log('Making HTTP request through Tor');
        const response = await fetch(url, {
          ...options,
          stream: ttcp.outer,
        });

        this.log('Request completed successfully', 'success');
        return response;
      }
    } catch (error) {
      this.log(`Request failed: ${(error as Error).message}`, 'error');

      // If circuit fails, clear it so next request will create a new one
      if (this.currentCircuit) {
        this.currentCircuit[Symbol.dispose]();
        this.currentCircuit = undefined;
        this.currentTor = undefined;
        this.log('Circuit cleared due to error');
      }

      throw error;
    }
  }

  /**
   * Updates the circuit with a deadline for graceful transition.
   * @param deadline Milliseconds to allow existing requests to use the old circuit. Defaults to 0.
   */
  async updateCircuit(deadline: number = 0): Promise<void> {
    const newDeadline = Date.now() + deadline;

    // Abort any scheduled update since we're manually updating now
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
      this.log('Aborted scheduled circuit update due to manual update');
    }

    // Reset scheduling state - next use will trigger new scheduling
    this.updateLoopActive = false;
    this.circuitUsed = false;
    this.nextUpdateTime = 0;

    // If there's already an update in progress, handle it gracefully
    if (this.isUpdatingCircuit) {
      const currentDeadline = this.updateDeadline;
      const moreAggressiveDeadline = Math.min(currentDeadline, newDeadline);

      this.log(
        `Update already in progress. Using more aggressive deadline: ` +
          `${moreAggressiveDeadline - Date.now()}ms (current: ${
            currentDeadline - Date.now()
          }ms, new: ${newDeadline - Date.now()}ms)`
      );

      // Always update to the more aggressive deadline
      this.updateDeadline = moreAggressiveDeadline;

      // Wait for the current update to complete
      this.log('Waiting for current update to complete with updated deadline');
      if (this.circuitPromise) {
        await this.circuitPromise;
      }
      return;
    }

    this.log(`Updating circuit with ${deadline}ms deadline`);

    // Set the update state and deadline
    this.isUpdatingCircuit = true;
    this.updateDeadline = newDeadline;

    try {
      // Start creating the new circuit in the background while keeping the old one
      // The old circuit will continue to serve requests until the deadline
      this.circuitPromise = (async () => {
        await initWasm();
        const tor = await this.createTorConnection();
        const circuit = await this.createCircuit(tor);

        // Clean up old circuit
        if (this.currentCircuit) {
          this.currentCircuit[Symbol.dispose]();
          this.log('Old circuit disposed');
        }

        this.currentTor = tor;
        this.currentCircuit = circuit;
        this.isUpdatingCircuit = false;
        this.circuitPromise = undefined;

        // Note: circuitUsed flag is reset by the scheduled update process
        // to ensure next use triggers new scheduling

        return circuit;
      })();

      await this.circuitPromise;
      this.log('Circuit update completed successfully', 'success');
    } catch (error) {
      this.log(`Circuit update failed: ${(error as Error).message}`, 'error');
      this.isUpdatingCircuit = false;
      this.updateDeadline = 0;
      throw error;
    }
  }

  /**
   * Waits for a circuit to be ready if one would be needed for requests.
   */
  async waitForCircuit(): Promise<void> {
    await this.getOrCreateCircuit();
  }

  /**
   * Gets the current circuit status information.
   * @returns Object containing circuit state, update status, and timing information
   */
  getCircuitStatus() {
    const now = Date.now();
    return {
      hasCircuit: !!this.currentCircuit,
      isCreating: !!this.circuitPromise && !this.currentCircuit,
      isUpdating: this.isUpdatingCircuit,
      updateDeadline: this.updateDeadline,
      timeToDeadline: this.updateDeadline > now ? this.updateDeadline - now : 0,
      updateActive: this.updateLoopActive,
      nextUpdateIn:
        this.nextUpdateTime > now ? this.nextUpdateTime - now : null,
    };
  }

  /**
   * Gets a human-readable status string for the current circuit state.
   */
  getCircuitStatusString(): string {
    const status = this.getCircuitStatus();

    if (!status.hasCircuit && status.isCreating) {
      return 'Creating...';
    }

    if (!status.hasCircuit) {
      return 'None';
    }

    if (status.isUpdating) {
      const timeLeft = Math.ceil(status.timeToDeadline / 1000);
      return `Ready, updating (${timeLeft}s until new circuit required)`;
    }

    if (status.nextUpdateIn !== null && status.nextUpdateIn > 0) {
      const timeLeft = Math.ceil(status.nextUpdateIn / 1000);
      return `Ready (creating next circuit in ${timeLeft}s)`;
    }

    return 'Ready';
  }

  /**
   * Closes the TorClient, cleaning up resources.
   */
  close(): void {
    // Stop the update loop
    this.updateLoopActive = false;

    // Clear the scheduled update timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }

    // Clear timing state
    this.nextUpdateTime = 0;

    // Close the consensus manager
    this.consensusManager.close();

    if (this.currentCircuit) {
      this.currentCircuit[Symbol.dispose]();
      this.log('Circuit disposed');
    }

    this.currentCircuit = undefined;
    this.currentTor?.close();
    this.currentTor = undefined;
    this.circuitPromise = undefined;
    this.isUpdatingCircuit = false;
    this.updateDeadline = 0;
    this.circuitUsed = false;
  }

  /**
   * Symbol.dispose implementation for automatic resource cleanup.
   * Calls close() to clean up all resources.
   */
  [Symbol.dispose](): void {
    this.close();
  }

  private log(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }

  private logError(
    prefix: string,
    error: unknown,
    defaultMessage: string
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : String(error || defaultMessage);
    this.log(`${prefix}: ${errorMessage}`, 'error');
  }

  private async createTorConnection(): Promise<TorClientDuplex> {
    this.log(`Connecting to Snowflake bridge at ${this.snowflakeUrl}`);

    const stream = await WebSocketDuplex.connect(
      this.snowflakeUrl,
      AbortSignal.timeout(this.connectionTimeout)
    );

    this.log('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    const tor = new TorClientDuplex();

    this.log('Connecting streams');
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
      this.log(`Tor client closed: ${reasonMessage}`, logLevel);
    });

    this.log(`Waiting for Tor to be ready (timeout: ${this.circuitTimeout}ms)`);
    await tor.waitOrThrow(AbortSignal.timeout(this.circuitTimeout));
    this.log('Tor client ready!', 'success');

    return tor;
  }

  private async createCircuit(tor: TorClientDuplex): Promise<Circuit> {
    this.log('Creating circuit');
    const circuit: Circuit = await tor.createOrThrow();
    this.log('Circuit created successfully', 'success');

    // Get consensus (from cache if fresh, or fetch if needed)
    const consensus = await this.consensusManager.getConsensus(circuit);

    this.log('Filtering relays');
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

    this.log(
      `Found ${middles.length} middle relays and ${exits.length} exit relays`
    );

    if (middles.length === 0 || exits.length === 0) {
      throw new Error('Not enough suitable relays found');
    }

    // Select middle relay and extend circuit
    this.log('Extending circuit through middle relay');
    const middle = middles[Math.floor(Math.random() * middles.length)];
    const middle2 = await Echalote.Consensus.Microdesc.fetchOrThrow(
      circuit,
      middle
    );
    await circuit.extendOrThrow(middle2, AbortSignal.timeout(10000));
    this.log('Extended through middle relay', 'success');

    // Select exit relay and extend circuit
    this.log('Extending circuit through exit relay');
    const exit = exits[Math.floor(Math.random() * exits.length)];
    const exit2 = await Echalote.Consensus.Microdesc.fetchOrThrow(
      circuit,
      exit
    );
    await circuit.extendOrThrow(exit2, AbortSignal.timeout(10000));
    this.log('Extended through exit relay', 'success');

    return circuit;
  }

  private async getOrCreateCircuit(): Promise<Circuit> {
    // If we're updating and past the deadline, wait for the new circuit
    if (
      this.isUpdatingCircuit &&
      Date.now() >= this.updateDeadline &&
      this.circuitPromise
    ) {
      this.log('Deadline passed, waiting for new circuit');
      return await this.circuitPromise;
    }

    // If we have a current circuit and we're not updating, or we're within the deadline
    if (
      this.currentCircuit &&
      (!this.isUpdatingCircuit || Date.now() < this.updateDeadline)
    ) {
      return this.currentCircuit;
    }

    // If we're already creating a circuit, wait for it
    if (this.circuitPromise) {
      return await this.circuitPromise;
    }

    // Create new circuit
    this.circuitPromise = (async () => {
      await initWasm();
      const tor = await this.createTorConnection();
      const circuit = await this.createCircuit(tor);

      // Clean up old circuit
      if (this.currentCircuit) {
        this.currentCircuit[Symbol.dispose]();
        this.log('Old circuit disposed');
      }

      this.currentTor = tor;
      this.currentCircuit = circuit;
      this.isUpdatingCircuit = false;
      this.circuitPromise = undefined;

      // Note: circuitUsed flag is reset by the scheduled update process
      // to ensure next use triggers new scheduling

      return circuit;
    })();

    return await this.circuitPromise;
  }

  private scheduleCircuitUpdate() {
    if (
      this.circuitUpdateInterval === null ||
      this.circuitUpdateInterval <= 0
    ) {
      this.log('Circuit auto-update disabled');
      return;
    }

    // If updates are already scheduled, don't schedule again
    if (this.updateLoopActive) {
      this.log('Circuit updates already scheduled');
      return;
    }

    this.log(
      `Scheduled next circuit update in ${this.circuitUpdateInterval}ms with ${this.circuitUpdateAdvance}ms advance`
    );

    // Set the loop as active
    this.updateLoopActive = true;

    // Schedule a single update, not a continuous loop
    const updateDelay = this.circuitUpdateInterval! - this.circuitUpdateAdvance;
    this.nextUpdateTime = Date.now() + updateDelay;

    this.updateTimer = setTimeout(async () => {
      // Check if we were disposed during the wait
      if (!this.updateLoopActive) {
        return;
      }

      try {
        // Clear next update time since we're starting the update now
        this.nextUpdateTime = 0;

        this.log('Scheduled circuit update triggered');
        await this.updateCircuit(this.circuitUpdateAdvance);

        // After update completes, reset the scheduling state
        // The next use will trigger scheduling again
        this.updateLoopActive = false;
        this.circuitUsed = false;
      } catch (error) {
        this.log(
          `Scheduled circuit update failed: ${(error as Error).message}`,
          'error'
        );
        // Reset state on error too
        this.updateLoopActive = false;
        this.circuitUsed = false;
      }
    }, updateDelay);
  }
}
