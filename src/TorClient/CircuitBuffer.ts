import { Circuit } from '../echalote';
import { EventEmitter } from './EventEmitter';

/**
 * Events emitted by CircuitBuffer.
 */
export type CircuitBufferEvents = {
  add: (count: number) => void;
  take: (count: number) => void;
  full: () => void;
  clear: () => void;
};

/**
 * Manages a FIFO buffer of ready circuits.
 * Simple data structure for storing and retrieving circuits in order.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class CircuitBuffer extends EventEmitter<CircuitBufferEvents> {
  private circuits: Circuit[] = [];
  private readonly maxSize: number;

  /**
   * Creates a new circuit buffer instance.
   *
   * @param maxSize Maximum number of circuits to store in buffer
   */
  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  /**
   * Adds a circuit to the buffer (end of FIFO queue).
   * If buffer is at max size, this circuit is not added.
   * Emits 'add' event on successful addition.
   *
   * @returns true if circuit was added, false if buffer is full
   */
  add(circuit: Circuit): boolean {
    if (this.circuits.length >= this.maxSize) {
      return false;
    }
    this.circuits.push(circuit);
    const newCount = this.circuits.length;
    this.emit('add', newCount);

    if (newCount === this.maxSize) {
      this.emit('full');
    }

    return true;
  }

  /**
   * Takes the oldest circuit from the buffer (start of FIFO queue).
   * Emits 'take' event when a circuit is removed.
   *
   * @returns oldest circuit or null if buffer is empty
   */
  takeOldest(): Circuit | null {
    const circuit = this.circuits.shift() ?? null;
    if (circuit) {
      this.emit('take', this.circuits.length);
    }
    return circuit;
  }

  /**
   * Returns the oldest circuit without removing it.
   *
   * @returns oldest circuit or null if buffer is empty
   */
  peek(): Circuit | null {
    return this.circuits.length > 0 ? this.circuits[0] : null;
  }

  /**
   * Gets the current number of circuits in buffer.
   */
  size(): number {
    return this.circuits.length;
  }

  /**
   * Checks if buffer has reached maximum capacity.
   */
  isFull(): boolean {
    return this.circuits.length >= this.maxSize;
  }

  /**
   * Gets all circuits currently in buffer.
   * Note: Don't modify the returned array!
   */
  getAll(): Circuit[] {
    return [...this.circuits];
  }

  /**
   * Disposes all circuits in buffer.
   * Emits 'clear' event when buffer is cleared.
   */
  clear(): void {
    for (const circuit of this.circuits) {
      try {
        (circuit as any)[Symbol.dispose]?.();
      } catch {
        // Ignore disposal errors
      }
    }
    this.circuits = [];
    this.emit('clear');
  }
}
