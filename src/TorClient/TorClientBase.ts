import '@hazae41/symbol-dispose-polyfill';
import './bufferPolyfill';

import { Ciphers, TlsClientDuplex } from '@hazae41/cadenas';
import { TorClientDuplex, createSnowflakeStream } from '../echalote';
import { fetch } from '../fleche';

import { WebSocketDuplex } from './WebSocketDuplex';
import { IStorage } from 'tor-hazae41/storage';
import { CircuitManager } from './CircuitManager';
import { getErrorDetails } from '../utils/getErrorDetails';
import { Log } from '../Log';
import { IClock } from '../clock';
import { App } from './App';
import { ConsensusManager } from './ConsensusManager';
import { MicrodescManager } from './MicrodescManager';

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
  /** Number of circuits to pre-create and maintain in buffer (default: 0, disabled) */
  circuitBuffer?: number;
  /** Maximum lifetime in milliseconds for circuits before disposal (default: 600000 = 10 minutes) */
  maxCircuitLifetime?: number;
  /** Optional logger instance for hierarchical logging */
  log?: Log;
}

export class TorClientBase {
  // FIXME: unused fields
  private snowflakeUrl: string;
  private connectionTimeout: number;
  private circuitTimeout: number;
  private circuitBuffer: number;
  private maxCircuitLifetime: number;
  private log: Log;
  private storage: IStorage;
  private clock: IClock;

  private app: App;

  // Consensus management
  private consensusManager: ConsensusManager;

  // Microdescriptor caching
  private microdescManager: MicrodescManager;

  // Circuit management
  private circuitManager: CircuitManager;

  constructor(options: TorClientOptions & { app: App }) {
    this.snowflakeUrl = options.snowflakeUrl;
    this.connectionTimeout = options.connectionTimeout ?? 15000;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.circuitBuffer = options.circuitBuffer ?? 2;
    this.maxCircuitLifetime = options.maxCircuitLifetime ?? 10 * 60_000; // 10 minutes
    this.app = options.app;
    this.clock = this.app.get('Clock');
    this.log = this.app.get('Log').child('TorClient');
    this.storage = this.app.get('Storage');
    this.consensusManager = this.app.get('ConsensusManager');
    this.microdescManager = this.app.get('MicrodescManager');
    this.circuitManager = this.app.get('CircuitManager');

    // FIXME: I don't think TorClientDuplex needs to be in factory?
    //        maybe CircuitManager should implement createTorConnection?
    this.app.register('TorClientDuplex', () => this.createTorConnection());

    // Note: Circuits are created proactively via circuitBuffer parameter.
    // The buffer maintains N ready-to-use circuits in the background.
  }

  /**
   * Makes a fetch request through Tor using this client's persistent circuit.
   * The circuit is reused across multiple requests until it reaches the end of its
   * lifetime, at which point it is disposed and a new circuit is created on the
   * next request.
   *
   * Use this method when you have multiple requests or want to maintain
   * a long-lived Tor connection with automatic circuit lifecycle management.
   *
   * @param url The URL to fetch
   * @param options Optional fetch options
   * @returns Promise resolving to the fetch Response
   */
  async fetch(url: string, options?: RequestInit): Promise<Response> {
    this.log.info(`Starting fetch request to ${url}`);

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : parsedUrl.protocol === 'https:'
        ? 443
        : 80;
    const isHttps = parsedUrl.protocol === 'https:';

    this.log.info(`Target: ${hostname}:${port} (HTTPS: ${isHttps})`);

    try {
      return await this.circuitManager.useCircuit(hostname, async circuit => {
        this.log.info(`Opening connection to ${hostname}:${port}`);
        const ttcp = await circuit.openOrThrow(hostname, port);

        if (isHttps) {
          this.log.info('Setting up TLS connection');
          const ciphers = [
            Ciphers.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
            Ciphers.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
          ];
          const ttls = new TlsClientDuplex({ host_name: hostname, ciphers });

          // Connect TLS streams
          ttcp.outer.readable
            .pipeTo(ttls.inner.writable)
            .catch((error: unknown) => {
              this.log.error(
                `TLS stream connection failed: ${getErrorDetails(error)}`
              );
            });
          ttls.inner.readable
            .pipeTo(ttcp.outer.writable)
            .catch((error: unknown) => {
              this.log.error(
                `TLS stream connection failed: ${getErrorDetails(error)}`
              );
            });

          this.log.info('Making HTTPS request through Tor');
          const response = await fetch(url, {
            ...options,
            stream: ttls.outer,
          });

          this.log.info('Request completed successfully');
          return response;
        } else {
          this.log.info('Making HTTP request through Tor');
          const response = await fetch(url, {
            ...options,
            stream: ttcp.outer,
          });

          this.log.info('Request completed successfully');
          return response;
        }
      });
    } catch (error) {
      this.log.error(`Request failed: ${(error as Error).message}`);

      // If circuit fails, clear only this host's circuit so Tor connection can be reused
      this.circuitManager.clearCircuit(hostname);

      throw error;
    }
  }

  /**
   * Waits for a circuit to be ready if one would be needed for requests.
   * This checks if the CircuitManager has at least one circuit available or being created.
   *
   * @throws Error if circuitBuffer is disabled (circuitBuffer=0) and no circuits are being created
   */
  async waitForCircuit(): Promise<void> {
    await this.circuitManager.waitForCircuitReady();
  }

  /**
   * Gets the current circuit state information.
   * @returns Object containing circuit state, update status, and timing information
   */
  getCircuitState() {
    return this.circuitManager.getCircuitState();
  }

  /**
   * Gets a human-readable status string for the current circuit state.
   */
  getCircuitStateString(): string | Record<string, string> {
    return this.circuitManager.getCircuitStateString();
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

  private async createTorConnection(): Promise<TorClientDuplex> {
    this.log.info(`Connecting to Snowflake bridge at ${this.snowflakeUrl}`);

    const stream = await WebSocketDuplex.connect(
      this.snowflakeUrl,
      AbortSignal.timeout(this.connectionTimeout)
    );

    this.log.info('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    const tor = new TorClientDuplex();

    this.log.info('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      this.log.error(`TCP -> Tor stream error: ${getErrorDetails(error)}`);
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      this.log.error(`Tor -> TCP stream error: ${getErrorDetails(error)}`);
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      this.log.error(`Tor client error: ${getErrorDetails(error)}`);
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      // Only log as error if there's an actual error reason
      const logLevel = reason && reason !== undefined ? 'error' : 'info';
      if (logLevel === 'error') {
        this.log.error(`Tor client closed: ${reasonMessage}`);
      } else {
        this.log.info(`Tor client closed: ${reasonMessage}`);
      }
    });

    this.log.info(
      `Waiting for Tor to be ready (timeout: ${this.circuitTimeout}ms)`
    );
    await tor.waitOrThrow(AbortSignal.timeout(this.circuitTimeout));
    this.log.info('Tor client ready!');

    return tor;
  }
}
