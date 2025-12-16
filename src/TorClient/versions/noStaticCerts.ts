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
import { CCADB } from '../../cadenas/mods/ccadb/CCADB';
import { fetchCerts } from '../../cadenas/mods/ccadb/fetchCerts';
import { getStorageName } from '../../storage/getStorageName.js';

export { type TorClientOptions } from '../TorClientBase';
export * as storage from '../../storage';
export { Log, type LogLevel } from '../../Log';

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
 *   snowflakeUrl: 'wss://snowflake.pse.dev/',
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
   *   snowflakeUrl: 'wss://snowflake.pse.dev/',
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

    app.set('Log', options.log ?? new Log({ rawLog: () => {} }));
    app.set('Storage', options.storage ?? createAutoStorage(getStorageName()));

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

    app.set('fetchCerts', fetchCerts);
    app.set('ccadb', new CCADB(app));

    return app;
  }
}
