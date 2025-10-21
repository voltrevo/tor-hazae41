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
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export class TorClient {
  private snowflakeUrl: string;
  private connectionTimeout: number;
  private circuitTimeout: number;
  private onLog?: (
    message: string,
    type?: 'info' | 'success' | 'error'
  ) => void;
  private static initialized = false;

  constructor(options: TorClientOptions) {
    this.snowflakeUrl = options.snowflakeUrl;
    this.connectionTimeout = options.connectionTimeout ?? 15000;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.onLog = options.onLog;
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

  async fetch(url: string, options?: RequestInit): Promise<Response> {
    this.log(`Starting fetch request to ${url}`);

    await this.init();

    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname;
    const port = parsedUrl.port
      ? parseInt(parsedUrl.port)
      : parsedUrl.protocol === 'https:'
        ? 443
        : 80;
    const isHttps = parsedUrl.protocol === 'https:';

    this.log(`Target: ${hostname}:${port} (HTTPS: ${isHttps})`);

    let tor: TorClientDuplex | undefined;
    let circuit: Circuit | undefined;

    try {
      tor = await this.createTorConnection();
      circuit = await this.createCircuit(tor);

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
      throw error;
    } finally {
      if (circuit) {
        circuit[Symbol.dispose]();
        this.log('Circuit disposed');
      }
    }
  }
}
