import { Log } from '../../Log';
import { assert } from '../../utils/assert';
import { TorClient, TorClientOptions } from './noStaticCerts';

let client: TorClient | undefined;

let config: TorClientOptions = {
  snowflakeUrl: 'wss://snowflake.pse.dev/',
  connectionTimeout: 15000,
  circuitTimeout: 90000,
  circuitBuffer: 2, // Maintain 2 circuits in buffer
  log: new Log({ rawLog: () => {} }),
};

export const tor = {
  async fetch(url: string, options?: RequestInit) {
    if (!client) {
      this.start();
      assert(client);
    }

    const res = await client.fetch(url, options);

    return res;
  },
  configure(customConfig: TorClientOptions) {
    config = customConfig;

    if (client) {
      client.close();
      client = undefined;
      this.start();
    }
  },
  start() {
    if (client) {
      return;
    }

    client = new TorClient(config);
  },
};
