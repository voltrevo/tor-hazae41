import { createAutoStorage } from '../../storage/index.js';
import { SystemClock } from '../../clock';
import { App } from '../App';
import { TorClientBase, TorClientOptions } from '../TorClientBase';
import { Log } from '../../Log';
import { CertificateManager } from '../CertificateManager';
import { MicrodescManager } from '../MicrodescManager';
import { ConsensusManager } from '../ConsensusManager';
import { CircuitBuilder } from '../CircuitBuilder';
import { CircuitManager } from '../CircuitManager';
import { staticCerts } from '../../cadenas/mods/ccadb/staticCerts';
import { CCADB } from '../../cadenas/mods/ccadb/CCADB';

export { type TorClientOptions } from '../TorClientBase';

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
export class TorClient extends TorClientBase {
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
    super({ ...options, app: TorClient.makeApp(options) });
  }

  private static makeApp(options: TorClientOptions): App {
    const app = new App();

    const clock = new SystemClock();
    app.set('Clock', clock);

    app.set('Log', options.log ?? new Log({ clock }).child('Tor'));
    app.set('Storage', createAutoStorage('tor-hazae41-cache'));

    app.set(
      'CertificateManager',
      new CertificateManager({ app, maxCached: 20 })
    );

    app.set('MicrodescManager', new MicrodescManager({ app, maxCached: 1000 }));
    app.register('CircuitBuilder', CircuitBuilder);

    app.set(
      'CircuitManager',
      new CircuitManager({
        snowflakeUrl: options.snowflakeUrl,
        connectionTimeout: options.connectionTimeout ?? 15_000,
        circuitTimeout: options.circuitTimeout ?? 90_000,
        maxCircuitLifetime: options.maxCircuitLifetime ?? 600_000,
        circuitBuffer: options.circuitBuffer ?? 2,
        app,
      })
    );

    app.set('ConsensusManager', new ConsensusManager({ app, maxCached: 5 }));

    app.set('fetchCerts', () => Promise.resolve(staticCerts));
    app.set('ccadb', new CCADB(app));

    return app;
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
  ) {
    const { connectionTimeout, circuitTimeout, log, ...fetchOptions } =
      options || {};

    const client = new TorClient({
      snowflakeUrl,
      connectionTimeout,
      circuitTimeout,
      log,
      circuitBuffer: 0, // No pre-creation for one-time use
    });

    try {
      return await client.fetch(url, fetchOptions);
    } finally {
      client.close();
    }
  }
}
