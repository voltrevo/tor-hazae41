import { createAutoStorage } from 'tor-hazae41/storage';
import { SystemClock } from '../../clock';
import { Factory } from '../../utils/Factory';
import { TorClientComponentMap } from '../factory';
import { TorClientBase, TorClientOptions } from '../TorClientBase';
import { Log } from '../../Log';
import { CertificateManager } from '../CertificateManager';
import { MicrodescManager } from '../MicrodescManager';
import { ConsensusManager } from '../ConsensusManager';
import { CircuitBuilder } from '../CircuitBuilder';
import { CircuitManager } from '../CircuitManager';

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
    super({ ...options, factory: TorClient.makeFactory(options) });
  }

  private static makeFactory(
    options: TorClientOptions
  ): Factory<TorClientComponentMap> {
    const factory = new Factory<TorClientComponentMap>();

    const clock = new SystemClock();
    factory.set('Clock', clock);
    factory.set('Log', options.log ?? new Log({ clock }));
    factory.set('Storage', createAutoStorage('tor-hazae41-cache'));

    factory.set(
      'CertificateManager',
      new CertificateManager({ factory, maxCached: 20 })
    );
    factory.set(
      'MicrodescManager',
      new MicrodescManager({ factory, maxCached: 1000 })
    );
    factory.set(
      'ConsensusManager',
      new ConsensusManager({ factory, maxCached: 5 })
    );
    factory.register('CircuitBuilder', CircuitBuilder);

    factory.set(
      'CircuitManager',
      new CircuitManager({
        circuitBuffer: options.circuitBuffer,
        maxCircuitLifetime: options.maxCircuitLifetime,
        circuitTimeout: options.circuitTimeout,
        factory,
      })
    );

    return factory;
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
