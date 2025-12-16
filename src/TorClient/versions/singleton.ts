import { Log } from '../../Log';
import { assert } from '../../utils/assert';
import { TorClient, TorClientOptions } from './noStaticCerts';
import * as storage from '../../storage';

let client: TorClient | undefined;

let config: TorClientOptions = {
  snowflakeUrl: 'wss://snowflake.pse.dev/',
  connectionTimeout: 15000,
  circuitTimeout: 90000,
  circuitBuffer: 2, // Maintain 2 circuits in buffer
  log: new Log({ rawLog: () => {} }),
};

const tor = {
  /**
   * Same as standard fetch, but powered by tor.
   * https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch
   */
  async fetch(url: string, options?: RequestInit) {
    if (!client) {
      this.start();
      assert(client);
    }

    const res = await client.fetch(url, options);

    return res;
  },

  /**
   * Configures the TorClient singleton.
   * Closes and restarts if already started.
   */
  configure(customConfig: TorClientOptions) {
    config = customConfig;

    if (client) {
      client.close();
      client = undefined;
      this.start();
    }
  },

  /**
   * Actively start the TorClient singleton.
   * This is optional - it's automatic if you just call fetch.
   * This library doesn't do anything until it is used, but it's beneficial to
   * call this early if you know you're going to use it.
   */
  start() {
    if (client) {
      return;
    }

    client = new TorClient(config);
  },
};

export { tor, Log, storage };
