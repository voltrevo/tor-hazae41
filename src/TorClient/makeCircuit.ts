import { Circuit, TorClientDuplex, createSnowflakeStream } from '../echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { getErrorDetails } from '../utils/getErrorDetails';

export async function makeCircuit(options: {
  /** The Snowflake bridge WebSocket URL for Tor connections */
  snowflakeUrl: string;
  /** Timeout in milliseconds for establishing initial connections (default: 15000) */
  connectionTimeout?: number;
  /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
  circuitTimeout?: number;
  /** Optional logger instance for hierarchical logging */
  log?: Log;
}) {
  const {
    snowflakeUrl,
    connectionTimeout = 15000,
    circuitTimeout = 90000,
    log: logInstance = new Log(),
  } = options;

  let tor: TorClientDuplex | undefined;
  let circuit: Circuit | undefined;

  try {
    // Initialize WASM
    await initWasm();

    // Create Tor connection
    logInstance.info(`Connecting to Snowflake bridge at ${snowflakeUrl}`);
    const stream = await WebSocketDuplex.connect(
      snowflakeUrl,
      AbortSignal.timeout(connectionTimeout)
    );

    logInstance.info('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    tor = new TorClientDuplex();

    logInstance.info('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      logInstance.error(
        `TCP -> Tor stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      logInstance.error(
        `Tor -> TCP stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      logInstance.error(
        `Tor client error: ${getErrorDetails(error) || 'Unknown error'}`
      );
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      if (reason && reason !== undefined) {
        logInstance.error(`Tor client closed: ${reasonMessage}`);
      } else {
        logInstance.info(`Tor client closed: ${reasonMessage}`);
      }
    });

    logInstance.info(
      `Waiting for Tor to be ready (timeout: ${circuitTimeout}ms)`
    );
    await tor.waitOrThrow(AbortSignal.timeout(circuitTimeout));
    logInstance.info('Tor client ready!');

    // Create circuit
    logInstance.info('Creating circuit');
    circuit = await tor.createOrThrow();
    logInstance.info('Circuit created successfully');

    return circuit;
  } catch (error) {
    logInstance.error(`Failed to create circuit: ${getErrorDetails(error)}`);
    // Clean up resources on error
    if (circuit) {
      circuit[Symbol.dispose]();
      logInstance.info('Circuit disposed after error');
    }
    if (tor) {
      tor.close();
      logInstance.info('Tor connection closed after error');
    }
    throw error;
  }
}
