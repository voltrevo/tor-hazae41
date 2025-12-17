import '@hazae41/symbol-dispose-polyfill';

import { Ciphers, TlsClientDuplex } from '../cadenas';
import { fetch } from '../fleche';

import { CircuitManager } from './CircuitManager';
import { getErrorDetails } from '../utils/getErrorDetails';
import { Log } from '../Log';
import { App, ComponentMap } from './App';
import { IStorage } from '../storage';
import { experimentalWarning } from './experimentalWarning';

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
  /** Number of circuits to pre-create and maintain in buffer (default: 2) */
  circuitBuffer?: number;
  /** Maximum lifetime in milliseconds for circuits before disposal (default: 600000 = 10 minutes) */
  maxCircuitLifetime?: number;
  /** Optional logger instance for hierarchical logging */
  log?: Log;
  /**
   * Optional storage interface for caching (default: tmp dir in nodejs,
   * indexeddb in browser).
   * Use `new storage.MemoryStorage()` to avoid secondary storage and only cache
   * during the current session.
   */
  storage?: IStorage;
}

export class TorClientBase {
  private log: Log;
  private app: App;

  // Circuit management
  private circuitManager: CircuitManager;

  constructor(options: TorClientOptions & { app: App }) {
    experimentalWarning();
    this.app = options.app;
    this.log = this.app.get('Log').child('TorClient');
    this.circuitManager = this.app.get('CircuitManager');
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
          const ttls = new TlsClientDuplex(this.app, {
            host_name: hostname,
            ciphers,
          });

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
      this.log.error(`Request failed: ${getErrorDetails(error)}`);

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
    const components: Record<keyof ComponentMap, true> = {
      Clock: true,
      Log: true,
      ConsensusManager: true,
      MicrodescManager: true,
      CertificateManager: true,
      CircuitBuilder: true,
      CircuitManager: true,
      Storage: true,
      ccadb: true,
      fetchCerts: true,
    };

    for (const name of Object.keys(components) as (keyof ComponentMap)[]) {
      const component = this.app.tryGet(name);

      if (component && 'close' in component) {
        component.close();
      }
    }
  }

  /**
   * Symbol.dispose implementation for automatic resource cleanup.
   * Calls close() to clean up all resources.
   */
  [Symbol.dispose](): void {
    this.close();
  }
}
