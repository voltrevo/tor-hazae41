import {
  Circuit,
  Echalote,
  TorClientDuplex,
  createSnowflakeStream,
} from '../echalote';
import { WebSocketDuplex } from './WebSocketDuplex';
import { initWasm } from './initWasm';
import { makeCircuit } from './makeCircuit';

export interface FetchMicrodescOptions {
  /** The Snowflake bridge WebSocket URL for Tor connections */
  snowflakeUrl: string;
  /** Timeout in milliseconds for establishing initial connections (default: 15000) */
  connectionTimeout?: number;
  /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
  circuitTimeout?: number;
  /** Optional logging callback function */
  onLog?: (message: string, type?: 'info' | 'success' | 'error') => void;
}

export async function fetchMicrodescNotAnon(
  microdescHash: string,
  options: FetchMicrodescOptions
) {
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
    const circuit = await makeCircuit(options);

    const microdesc = await Echalote.Consensus.Microdesc.fetchBodyOrThrow(
      circuit,
      microdescHash
    );

    return microdesc;
  } catch (error) {
    log(`Failed to fetch consensus: ${(error as Error).message}`, 'error');
    throw error;
  } finally {
    // Clean up resources
    if (circuit) {
      circuit[Symbol.dispose]();
      log('Circuit disposed');
    }
    if (tor) {
      tor.close();
      log('Tor connection closed');
    }
  }
}
