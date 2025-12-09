import { Circuit } from '../echalote';
import { EventEmitter } from './EventEmitter';

/**
 * Status of a circuit in the lifecycle.
 */
export type CircuitStatus =
  | 'buffered' // Waiting in buffer
  | 'allocating' // Being assigned to a host
  | 'allocated' // Assigned to a host and ready
  | 'disposed'; // Disposed and unavailable

/**
 * Snapshot of a circuit's current state.
 */
export interface CircuitStateSnapshot {
  status: CircuitStatus;
  allocatedHost?: string;
  allocatedAt?: number;
  lastUsed: number;
}

/**
 * Internal state for tracking a circuit.
 */
interface CircuitStateInternal {
  status: CircuitStatus;
  allocatedHost?: string;
  allocatedAt: number;
  lastUsed: number;
}

/**
 * Events emitted by CircuitStateTracker.
 */
export type CircuitStateTrackerEvents = {
  initialize: (circuit: Circuit) => void;
  allocate: (circuit: Circuit, host: string) => void;
  deallocate: (circuit: Circuit) => void;
  'mark-used': (circuit: Circuit) => void;
  dispose: (circuit: Circuit) => void;
};

/**
 * Tracks the lifecycle state of circuits.
 * Provides state machine transitions and queries.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class CircuitStateTracker extends EventEmitter<CircuitStateTrackerEvents> {
  private states: Map<Circuit, CircuitStateInternal> = new Map();

  constructor() {
    super();
  }

  /**
   * Initializes state for a new circuit (starts as 'buffered').
   */
  initialize(circuit: Circuit): void {
    if (this.states.has(circuit)) {
      throw new Error('Circuit already initialized');
    }

    this.states.set(circuit, {
      status: 'buffered',
      allocatedAt: 0,
      lastUsed: 0,
    });

    this.emit('initialize', circuit);
  }

  /**
   * Allocates a circuit to a specific host (transitions 'buffered' → 'allocated').
   */
  allocate(circuit: Circuit, host: string): void {
    const state = this.getInternal(circuit);

    if (state.status !== 'buffered' && state.status !== 'allocated') {
      throw new Error(
        `Cannot allocate circuit in '${state.status}' status (must be 'buffered' or 'allocated')`
      );
    }

    state.status = 'allocated';
    state.allocatedHost = host;
    state.allocatedAt = Date.now();
    state.lastUsed = Date.now();

    this.emit('allocate', circuit, host);
  }

  /**
   * Deallocates a circuit from its host (transitions 'allocated' → 'buffered').
   */
  deallocate(circuit: Circuit): void {
    const state = this.getInternal(circuit);

    if (state.status !== 'allocated') {
      throw new Error(
        `Cannot deallocate circuit in '${state.status}' status (must be 'allocated')`
      );
    }

    state.status = 'buffered';
    state.allocatedHost = undefined;
    state.allocatedAt = 0;

    this.emit('deallocate', circuit);
  }

  /**
   * Marks a circuit as just being used (updates lastUsed timestamp).
   */
  markUsed(circuit: Circuit): void {
    const state = this.getInternal(circuit);
    state.lastUsed = Date.now();

    this.emit('mark-used', circuit);
  }

  /**
   * Gets a snapshot of the circuit's current state.
   */
  get(circuit: Circuit): CircuitStateSnapshot {
    const state = this.getInternal(circuit);
    return {
      status: state.status,
      allocatedHost: state.allocatedHost,
      allocatedAt: state.allocatedAt,
      lastUsed: state.lastUsed,
    };
  }

  /**
   * Checks if a circuit has been allocated.
   */
  hasBeenUsed(circuit: Circuit): boolean {
    const state = this.getInternal(circuit);
    return state.status === 'allocated' || state.allocatedAt > 0;
  }

  /**
   * Gets milliseconds since the circuit was last used.
   */
  getIdleTime(circuit: Circuit): number {
    const state = this.getInternal(circuit);
    return Date.now() - state.lastUsed;
  }

  /**
   * Disposes of a circuit (removes its state).
   */
  dispose(circuit: Circuit): void {
    this.states.delete(circuit);
    this.emit('dispose', circuit);
  }

  /**
   * Checks if a circuit is tracked.
   */
  has(circuit: Circuit): boolean {
    return this.states.has(circuit);
  }

  /**
   * Gets internal state, throws if not found.
   */
  private getInternal(circuit: Circuit): CircuitStateInternal {
    const state = this.states.get(circuit);
    if (!state) {
      throw new Error('Circuit state not found - circuit not initialized');
    }
    return state;
  }

  /**
   * Disposes all tracked circuits.
   */
  clear(): void {
    this.states.clear();
  }
}
