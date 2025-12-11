import { Circuit, TorClientDuplex, createSnowflakeStream } from '../echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { getErrorDetails } from '../utils/getErrorDetails';
import { createTorClientFactory } from './factory';

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
    log: logInstance,
  } = options;

  // Use factory to create logger if not provided
  const factory = createTorClientFactory({ log: logInstance });
  const logger = factory.create('log', { namePrefix: 'makeCircuit' });

  let tor: TorClientDuplex | undefined;
  let circuit: Circuit | undefined;

  try {
    // Initialize WASM
    await initWasm();

    // Create Tor connection
    logger.info(`Connecting to Snowflake bridge at ${snowflakeUrl}`);
    const stream = await WebSocketDuplex.connect(
      snowflakeUrl,
      AbortSignal.timeout(connectionTimeout)
    );

    logger.info('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    tor = new TorClientDuplex();

    logger.info('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      logger.error(
        `TCP -> Tor stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      logger.error(
        `Tor -> TCP stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      logger.error(
        `Tor client error: ${getErrorDetails(error) || 'Unknown error'}`
      );
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      if (reason && reason !== undefined) {
        logger.error(`Tor client closed: ${reasonMessage}`);
      } else {
        logger.info(`Tor client closed: ${reasonMessage}`);
      }
    });

    logger.info(`Waiting for Tor to be ready (timeout: ${circuitTimeout}ms)`);
    await tor.waitOrThrow(AbortSignal.timeout(circuitTimeout));
    logger.info('Tor client ready!');

    // Create circuit
    logger.info('Creating circuit');
    circuit = await tor.createOrThrow();
    logger.info('Circuit created successfully');

    console.error('FIXME: circuit should eventually get cleaned up');
    return circuit;
  } catch (error) {
    logger.error(`Failed to create circuit: ${getErrorDetails(error)}`);
    // Clean up resources on error
    if (circuit) {
      circuit[Symbol.dispose]();
      logger.info('Circuit disposed after error');
    }
    if (tor) {
      tor.close();
      logger.info('Tor connection closed after error');
    }
    throw error;
  }
}
