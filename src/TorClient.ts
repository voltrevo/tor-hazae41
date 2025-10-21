import './bufferPolyfill';

import { WalletWasm } from '@brumewallet/wallet.wasm';
import { Ciphers, TlsClientDuplex } from '@hazae41/cadenas';
import { ChaCha20Poly1305 } from '@hazae41/chacha20poly1305';
import {
  Circuit,
  Echalote,
  TorClientDuplex,
  createSnowflakeStream,
} from '@hazae41/echalote';
import { Ed25519 } from '@hazae41/ed25519';
import { fetch } from '@hazae41/fleche';
import { Keccak256 } from '@hazae41/keccak256';
import { Ripemd160 } from '@hazae41/ripemd160';
import { Sha1 } from '@hazae41/sha1';
import { X25519 } from '@hazae41/x25519';
import { WebSocketDuplex } from './WebSocketDuplex';

export interface TorClientOptions {
  snowflakeUrl: string;
  connectionTimeout?: number;
  circuitTimeout?: number;
  createCircuitEarly?: boolean;
  circuitUpdateInterval?: number | null;
  circuitUpdateAdvance?: number;
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

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
  private static initialized = false;

  // Circuit state management
  private currentTor?: TorClientDuplex;
  private currentCircuit?: Circuit;
  private circuitPromise?: Promise<Circuit>;
  private isUpdatingCircuit = false;
  private updateDeadline = 0;
  private updateTimer?: NodeJS.Timeout;
  private updateLoopActive = false;
  private nextUpdateTime = 0;

  constructor(options: TorClientOptions) {
    this.snowflakeUrl = options.snowflakeUrl;
    this.connectionTimeout = options.connectionTimeout ?? 15000;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.createCircuitEarly = options.createCircuitEarly ?? true;
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000; // 10 minutes
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000; // 1 minute
    this.onLog = options.onLog;

    // Create first circuit immediately if requested
    if (this.createCircuitEarly) {
      this.getOrCreateCircuit().catch(error => {
        this.log(`Failed to create initial circuit: ${error.message}`, 'error');
      });
    }

    // Schedule regular circuit updates
    this.scheduleCircuitUpdates();
  }

  private log(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    if (this.onLog) {
      this.onLog(message, type);
    }
  }

  private async init(): Promise<void> {
    if (TorClient.initialized) return;

    this.log('Initializing WASM modules');
    await WalletWasm.initBundled();

    Sha1.set(Sha1.fromWasm(WalletWasm));
    Keccak256.set(Keccak256.fromWasm(WalletWasm));
    Ripemd160.set(Ripemd160.fromWasm(WalletWasm));
    ChaCha20Poly1305.set(ChaCha20Poly1305.fromWasm(WalletWasm));

    Ed25519.set(await Ed25519.fromNativeOrWasm(WalletWasm));
    X25519.set(X25519.fromWasm(WalletWasm));

    TorClient.initialized = true;
    this.log('WASM modules initialized successfully', 'success');
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
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: Error) => {
      this.log(`TCP -> Tor stream error: ${error.message}`, 'error');
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: Error) => {
      this.log(`Tor -> TCP stream error: ${error.message}`, 'error');
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      this.log(`Tor client error: ${error}`, 'error');
    });

    tor.events.on('close', (reason: unknown) => {
      this.log(`Tor client closed: ${reason}`, 'error');
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

    this.log('Fetching consensus');
    const consensus = await Echalote.Consensus.fetchOrThrow(circuit);
    this.log(
      `Consensus fetched with ${consensus.microdescs.length} microdescs`,
      'success'
    );

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
      await this.init();
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

      return circuit;
    })();

    return await this.circuitPromise;
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
      client.dispose();
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
        await this.init();
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

  private scheduleCircuitUpdates() {
    if (
      this.circuitUpdateInterval === null ||
      this.circuitUpdateInterval <= 0
    ) {
      this.log('Circuit auto-update disabled');
      return;
    }

    this.log(
      `Scheduled circuit updates every ${this.circuitUpdateInterval}ms with ${this.circuitUpdateAdvance}ms advance`
    );

    // Set the loop as active
    this.updateLoopActive = true;

    // Run the update loop in the background
    (async () => {
      while (this.updateLoopActive && this.circuitUpdateInterval !== null) {
        try {
          // Calculate next update time
          const updateDelay =
            this.circuitUpdateInterval! - this.circuitUpdateAdvance;
          this.nextUpdateTime = Date.now() + updateDelay;

          // Wait for the interval minus advance time
          await new Promise<void>(resolve => {
            this.updateTimer = setTimeout(() => {
              resolve();
            }, updateDelay);
          });

          // Check if we were disposed during the wait
          if (!this.updateLoopActive) {
            break;
          }

          // Clear next update time since we're starting the update now
          this.nextUpdateTime = 0;

          this.log('Scheduled circuit update triggered');
          await this.updateCircuit(this.circuitUpdateAdvance);
        } catch (error) {
          this.log(
            `Scheduled circuit update failed: ${(error as Error).message}`,
            'error'
          );
          // Continue the loop even if update failed
        }
      }
    })();
  }

  /**
   * Disposes the current circuit and clears all state.
   */
  dispose(): void {
    // Stop the update loop
    this.updateLoopActive = false;

    // Clear the scheduled update timer
    if (this.updateTimer) {
      clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }

    // Clear timing state
    this.nextUpdateTime = 0;

    if (this.currentCircuit) {
      this.currentCircuit[Symbol.dispose]();
      this.log('Circuit disposed');
    }

    this.currentCircuit = undefined;
    this.currentTor = undefined;
    this.circuitPromise = undefined;
    this.isUpdatingCircuit = false;
    this.updateDeadline = 0;
  }
}
