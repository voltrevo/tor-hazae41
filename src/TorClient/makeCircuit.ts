import {
  Circuit,
  TorClientDuplex,
  createSnowflakeStream,
} from '../hazae41/echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { Log } from '../Log';
import { getErrorDetails } from '../utils/getErrorDetails';
import { App } from './App';

export async function makeCircuit(
  app: App,
  options: {
    /** The Snowflake bridge WebSocket URL for Tor connections */
    snowflakeUrl: string;
    /** Timeout in milliseconds for establishing initial connections (default: 15000) */
    connectionTimeout?: number;
    /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
    circuitTimeout?: number;
    /** Optional logger instance for hierarchical logging */
    log?: Log;
  }
) {
  const {
    snowflakeUrl,
    connectionTimeout = 15000,
    circuitTimeout = 90000,
    log = new Log(),
  } = options;

  let tor: TorClientDuplex | undefined;
  let circuit: Circuit | undefined;

  try {
    // Create Tor connection
    log.info(`Connecting to Snowflake bridge at ${snowflakeUrl}`);
    const stream = await WebSocketDuplex.connect(
      snowflakeUrl,
      AbortSignal.timeout(connectionTimeout)
    );

    log.info('Creating Snowflake stream');
    const tcp = createSnowflakeStream(stream);
    tor = new TorClientDuplex(app);

    log.info('Connecting streams');
    tcp.outer.readable.pipeTo(tor.inner.writable).catch((error: unknown) => {
      log.error(
        `TCP -> Tor stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    tor.inner.readable.pipeTo(tcp.outer.writable).catch((error: unknown) => {
      log.error(
        `Tor -> TCP stream error: ${getErrorDetails(error) || 'Stream pipe error'}`
      );
    });

    // Add event listeners for debugging
    tor.events.on('error', (error: unknown) => {
      log.error(
        `Tor client error: ${getErrorDetails(error) || 'Unknown error'}`
      );
    });

    tor.events.on('close', (reason: unknown) => {
      const reasonMessage =
        reason instanceof Error
          ? reason.message
          : String(reason || 'Connection closed normally');
      if (reason && reason !== undefined) {
        log.error(`Tor client closed: ${reasonMessage}`);
      } else {
        log.info(`Tor client closed: ${reasonMessage}`);
      }
    });

    log.info(`Waiting for Tor to be ready (timeout: ${circuitTimeout}ms)`);
    await tor.waitOrThrow(AbortSignal.timeout(circuitTimeout));
    log.info('Tor client ready!');

    // Create circuit
    log.info('Creating circuit');
    circuit = await tor.createOrThrow();
    log.info('Circuit created successfully');

    console.error('FIXME: circuit should eventually get cleaned up');
    return circuit;
  } catch (error) {
    log.error(`Failed to create circuit: ${getErrorDetails(error)}`);
    // Clean up resources on error
    if (circuit) {
      circuit[Symbol.dispose]();
      log.info('Circuit disposed after error');
    }
    if (tor) {
      tor.close();
      log.info('Tor connection closed after error');
    }
    throw error;
  }
}
