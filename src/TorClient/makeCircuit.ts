import { Circuit, TorClientDuplex, createSnowflakeStream } from '../echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { initWasm } from './initWasm';

export async function makeCircuit(options: {
  /** The Snowflake bridge WebSocket URL for Tor connections */
  snowflakeUrl: string;
  /** Timeout in milliseconds for establishing initial connections (default: 15000) */
  connectionTimeout?: number;
  /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
  circuitTimeout?: number;
  /** Optional logging callback function */
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}) {
  const {
    snowflakeUrl,
    connectionTimeout = 15000,
    circuitTimeout = 90000,
    onLog,
  } = options;

  const log = (
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void => {
    if (onLog) {
      onLog(message, type);
    }
  };

  const logError = (
    prefix: string,
    error: unknown,
    defaultMessage: string
  ): void => {
    const errorMessage =
      error instanceof Error ? error.message : String(error || defaultMessage);
    log(`${prefix}: ${errorMessage}`, 'error');
  };

  let tor: TorClientDuplex | undefined;
  let circuit: Circuit | undefined;

  try {
    // Initialize WASM
    await initWasm();

    // Create Tor connection
    log(`Connecting to Snowflake bridge at ${snowflakeUrl}`);
    const stream = await WebSocketDuplex.connect(
      snowflakeUrl,
      AbortSignal.timeout(connectionTimeout)
    );

    log('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    tor = new TorClientDuplex();

    log('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      logError('TCP -> Tor stream error', error, 'Stream pipe error');
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      logError('Tor -> TCP stream error', error, 'Stream pipe error');
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      logError('Tor client error', error, 'Unknown error');
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      const logLevel = reason && reason !== undefined ? 'error' : 'info';
      log(`Tor client closed: ${reasonMessage}`, logLevel);
    });

    log(`Waiting for Tor to be ready (timeout: ${circuitTimeout}ms)`);
    await tor.waitOrThrow(AbortSignal.timeout(circuitTimeout));
    log('Tor client ready!', 'success');

    // Create circuit
    log('Creating circuit');
    circuit = await tor.createOrThrow();
    log('Circuit created successfully', 'success');

    return circuit;
  } catch (error) {
    log(`Failed to fetch consensus: ${(error as Error).message}`, 'error');
    throw error;
  } finally {
    console.error('FIXME: clean up resources');
    // // Clean up resources
    // if (circuit) {
    //   circuit[Symbol.dispose]();
    //   log('Circuit disposed');
    // }
    // if (tor) {
    //   tor.close();
    //   log('Tor connection closed');
    // }
  }
}
