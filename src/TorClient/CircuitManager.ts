import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { getErrorDetails } from '../utils/getErrorDetails';
import { selectRandomElement } from '../utils/random';
import { isMiddleRelay, isExitRelay } from '../utils/relayFilters';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { IClock } from '../clock';

// FIXME: CircuitManager is big and untested
// identify abstract subcomponents that could be split out and pursue testing
// of the smaller components (we might not be ready to test this as a whole)

/**
 * Configuration options for the CircuitManager.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 * Instances are created by TorClient and should not be instantiated manually.
 */
export interface CircuitManagerOptions {
  /** Clock instance for managing timeouts and delays */
  clock: IClock;
  /** Timeout in milliseconds for circuit creation and readiness (default: 90000) */
  circuitTimeout?: number;
  /** Interval in milliseconds between automatic circuit updates, or null to disable (default: 600000 = 10 minutes) */
  circuitUpdateInterval?: number | null;
  /** Time in milliseconds to allow old circuit usage before forcing new circuit during updates (default: 60000 = 1 minute) */
  circuitUpdateAdvance?: number;
  /** Timeout in milliseconds for disposing unused circuits (default: 300000 = 5 minutes) */
  circuitIdleTimeout?: number;
  /** Number of circuits to maintain in buffer (default: 0, disabled) */
  circuitBuffer?: number;
  /** Logger instance for hierarchical logging */
  log: Log;
  /** Function to create a Tor connection */
  createTorConnection: () => Promise<TorClientDuplex>;
  /** Function to get the current consensus */
  getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
}

/**
 * Circuit status information for a specific host
 */
export interface CircuitStatus {
  hasCircuit: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  updateDeadline: number;
  timeToDeadline: number;
  updateActive: boolean;
  nextUpdateIn: number | null;
  idleTime: number;
}

/**
 * Per-circuit state tracking
 */
interface CircuitState {
  allocatedAt: number; // When allocated to a host (0 if buffered)
  allocatedHost?: string; // Which host owns this circuit
  isUpdatingCircuit: boolean;
  updateDeadline: number;
  updateTimer?: unknown;
  updateLoopActive: boolean;
  nextUpdateTime: number;
  circuitUsed: boolean;
  lastUsed: number;
}

/**
 * Manages Tor circuit lifecycle with circuit buffering capability.
 * Maintains a shared Tor connection and manages circuit allocation to hosts.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 * Instances are created by TorClient and should not be instantiated manually.
 */
export class CircuitManager {
  private clock: IClock;
  private circuitTimeout: number;
  private circuitUpdateInterval: number | null;
  private circuitUpdateAdvance: number;
  private circuitIdleTimeout: number;
  private circuitBufferSize: number;
  private log: Log;
  private createTorConnection: () => Promise<TorClientDuplex>;
  private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;

  // Shared Tor connection
  private torConnection?: TorClientDuplex;
  private torConnectionPromise?: Promise<TorClientDuplex>;

  // Circuit buffer management
  private circuitBuffer: Circuit[] = []; // Ordered by completion time
  private circuitCreationQueue: Set<Promise<Circuit>> = new Set();
  private bufferRefillBackoffMs: number = 5000;
  private lastBufferRefillTime: number = 0;
  private readonly MIN_BUFFER_REFILL_MS = 5000;
  private readonly MAX_BUFFER_REFILL_MS = 60000;
  private readonly BACKOFF_MULTIPLIER = 1.1;
  private bufferFillTaskActive = false;

  // Host ownership tracking
  private circuitOwnershipMap: Map<Circuit, string> = new Map();
  private hostCircuitMap: Map<string, Circuit> = new Map();
  private circuitAllocationTasks: Map<string, Promise<Circuit>> = new Map();

  // Per-circuit state
  private circuitStates: Map<Circuit, CircuitState> = new Map();
  private circuitIdleTimers: Map<Circuit, unknown> = new Map();
  private circuitUpdateTimers: Map<Circuit, unknown> = new Map();

  constructor(options: CircuitManagerOptions) {
    this.clock = options.clock;
    this.circuitTimeout = options.circuitTimeout ?? 90000;
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000;
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000;
    this.circuitIdleTimeout = options.circuitIdleTimeout ?? 5 * 60_000;
    this.circuitBufferSize = options.circuitBuffer ?? 0;
    this.log = options.log;
    this.createTorConnection = options.createTorConnection;
    this.getConsensus = options.getConsensus;

    // Start background buffer filling if buffer size > 0
    if (this.circuitBufferSize > 0) {
      this.backgroundBufferCircuits().catch(error => {
        this.log.error(
          `[Buffered] Failed to initialize circuit buffer: ${getErrorDetails(error)}`
        );
      });
    }
  }

  /**
   * Gets or creates a circuit for the specified hostname.
   */
  async getOrCreateCircuit(hostname: string): Promise<Circuit> {
    // Cancel idle timer if circuit exists for this host
    const existingCircuit = this.hostCircuitMap.get(hostname);
    if (existingCircuit) {
      const state = this.circuitStates.get(existingCircuit);
      if (state) {
        const idleTimer = this.circuitIdleTimers.get(existingCircuit);
        if (idleTimer) {
          this.clock.clearTimeout(idleTimer);
          this.circuitIdleTimers.delete(existingCircuit);
        }
        state.lastUsed = Date.now();
      }

      // Handle update deadline logic
      if (
        state?.isUpdatingCircuit &&
        Date.now() >= state.updateDeadline &&
        this.circuitAllocationTasks.has(hostname)
      ) {
        this.logMessage(hostname, 'Deadline passed, waiting for new circuit');
        return await this.circuitAllocationTasks.get(hostname)!;
      }

      if (
        state &&
        (!state.isUpdatingCircuit || Date.now() < state.updateDeadline)
      ) {
        return existingCircuit;
      }
    }

    // If we're already allocating a circuit for this host, wait for it
    if (this.circuitAllocationTasks.has(hostname)) {
      return await this.circuitAllocationTasks.get(hostname)!;
    }

    // Allocate a circuit to this host
    const allocationPromise = this.allocateCircuitToHost(hostname);
    this.circuitAllocationTasks.set(hostname, allocationPromise);
    try {
      return await allocationPromise;
    } finally {
      this.circuitAllocationTasks.delete(hostname);
    }
  }

  /**
   * Allocates a buffered circuit to a host, or creates one if buffer is empty.
   */
  private async allocateCircuitToHost(hostname: string): Promise<Circuit> {
    let circuit = this.getOldestBufferedCircuit();

    if (!circuit) {
      // No buffered circuit available, create one
      this.logMessage(hostname, 'No buffered circuits, creating on-demand');
      circuit = await this.createNewCircuit();
    } else {
      this.logMessage(hostname, 'Allocated buffered circuit');
      // Remove from buffer (oldest first)
      this.circuitBuffer.shift();
    }

    // Allocate to hostname
    const state = this.circuitStates.get(circuit)!;
    state.allocatedAt = Date.now();
    state.allocatedHost = hostname;
    state.lastUsed = Date.now();

    this.circuitOwnershipMap.set(circuit, hostname);
    this.hostCircuitMap.set(hostname, circuit);

    // Cancel idle timer (allocated circuits don't idle out)
    const idleTimer = this.circuitIdleTimers.get(circuit);
    if (idleTimer) {
      this.clock.clearTimeout(idleTimer);
      this.circuitIdleTimers.delete(circuit);
    }

    // Schedule update timer and mark as used
    this.scheduleCircuitUpdate(circuit, hostname);
    state.circuitUsed = true;

    // Trigger buffer refill if needed
    if (this.circuitBufferSize > 0) {
      this.backgroundBufferCircuits().catch(error => {
        this.logMessage(
          'Buffered',
          `Failed to refill buffer after allocation: ${getErrorDetails(error)}`,
          'error'
        );
      });
    }

    return circuit;
  }

  /**
   * Gets the oldest buffered circuit (FIFO order).
   */
  private getOldestBufferedCircuit(): Circuit | null {
    return this.circuitBuffer.length > 0 ? this.circuitBuffer[0] : null;
  }

  /**
   * Maintains the circuit buffer by creating circuits in parallel.
   * Uses completion order, not start order.
   */
  private async backgroundBufferCircuits(): Promise<void> {
    if (this.circuitBufferSize === 0 || this.bufferFillTaskActive) {
      return;
    }

    this.bufferFillTaskActive = true;

    try {
      while (this.circuitBuffer.length < this.circuitBufferSize) {
        const needed = this.circuitBufferSize - this.circuitBuffer.length;
        const creationPromises: Promise<Circuit>[] = [];

        // Start N circuit creation tasks in parallel
        for (let i = 0; i < needed; i++) {
          const promise = this.createNewCircuit();
          creationPromises.push(promise);
          this.circuitCreationQueue.add(promise);
        }

        // Add to buffer in order of completion (not start)
        for (const promise of creationPromises) {
          try {
            const circuit = await promise;
            this.circuitBuffer.push(circuit);

            this.scheduleBufferedCircuitIdleCleanup(circuit);
            this.logMessage(
              'Buffered',
              `Circuit ready (${this.circuitBuffer.length}/${this.circuitBufferSize})`
            );

            // Reset backoff on successful creation
            this.resetBufferRefillBackoff();

            this.circuitCreationQueue.delete(promise);
          } catch (error) {
            this.logMessage(
              'Buffered',
              `Circuit creation failed: ${getErrorDetails(error)}`,
              'error'
            );
            this.circuitCreationQueue.delete(promise);
          }
        }

        // If we couldn't create enough circuits, apply backoff
        if (this.circuitBuffer.length < this.circuitBufferSize) {
          await this.applyBackoffAndRetry();
        }
      }
    } finally {
      this.bufferFillTaskActive = false;
    }
  }

  /**
   * Applies exponential backoff: 5s → ramps up to 60s → resets to 5s on success.
   */
  private async applyBackoffAndRetry(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRefill = now - this.lastBufferRefillTime;

    // If total loop time < minimum, wait to reach it
    if (timeSinceLastRefill < this.bufferRefillBackoffMs) {
      const waitTime = this.bufferRefillBackoffMs - timeSinceLastRefill;
      this.logMessage(
        'Buffered',
        `Retry backoff: waiting ${waitTime}ms before next attempt`
      );
      await new Promise(resolve => {
        this.clock.setTimeout(resolve as () => void, waitTime);
      });
    }

    // Increase backoff for next time (up to max)
    this.bufferRefillBackoffMs = Math.min(
      this.bufferRefillBackoffMs * this.BACKOFF_MULTIPLIER,
      this.MAX_BUFFER_REFILL_MS
    );

    this.lastBufferRefillTime = Date.now();
  }

  /**
   * Resets backoff to minimum on successful buffer refill.
   */
  private resetBufferRefillBackoff(): void {
    this.bufferRefillBackoffMs = this.MIN_BUFFER_REFILL_MS;
    this.lastBufferRefillTime = Date.now();
  }

  /**
   * Updates the circuit for a specific host (or all hosts if hostname is undefined).
   */
  async updateCircuit(hostname?: string, deadline: number = 0): Promise<void> {
    if (hostname === undefined) {
      // Update all allocated hosts
      const hosts = Array.from(this.hostCircuitMap.keys());
      await Promise.all(hosts.map(h => this.updateCircuit(h, deadline)));
      return;
    }

    const circuit = this.hostCircuitMap.get(hostname);
    if (!circuit) {
      this.logMessage(hostname, 'No circuit to update');
      return;
    }

    const state = this.circuitStates.get(circuit);
    if (!state) {
      return;
    }

    const newDeadline = Date.now() + deadline;

    // Abort any scheduled update
    if (state.updateTimer) {
      this.clock.clearTimeout(state.updateTimer);
      state.updateTimer = undefined;
      this.logMessage(hostname, 'Aborted scheduled circuit update');
    }

    // Reset scheduling state
    state.updateLoopActive = false;
    state.circuitUsed = false;
    state.nextUpdateTime = 0;

    // If already updating, handle gracefully
    if (state.isUpdatingCircuit) {
      const currentDeadline = state.updateDeadline;
      const moreAggressiveDeadline = Math.min(currentDeadline, newDeadline);

      this.logMessage(
        hostname,
        `Update already in progress. Using more aggressive deadline: ` +
          `${moreAggressiveDeadline - Date.now()}ms`
      );

      state.updateDeadline = moreAggressiveDeadline;

      if (this.circuitAllocationTasks.has(hostname)) {
        await this.circuitAllocationTasks.get(hostname);
      }
      return;
    }

    this.logMessage(hostname, `Updating circuit with ${deadline}ms deadline`);

    state.isUpdatingCircuit = true;
    state.updateDeadline = newDeadline;

    try {
      // Create new circuit for this host
      const allocationPromise = this.allocateCircuitToHost(hostname);
      this.circuitAllocationTasks.set(hostname, allocationPromise);
      await allocationPromise;

      this.logMessage(
        hostname,
        'Circuit update completed successfully',
        'success'
      );
    } catch (error) {
      this.logMessage(
        hostname,
        `Circuit update failed: ${(error as Error).message}`,
        'error'
      );
      state.isUpdatingCircuit = false;
      state.updateDeadline = 0;
      throw error;
    } finally {
      this.circuitAllocationTasks.delete(hostname);
    }
  }

  /**
   * Marks the circuit for a host as used and schedules updates if not already scheduled.
   */
  markCircuitUsed(hostname: string): void {
    const circuit = this.hostCircuitMap.get(hostname);
    if (circuit) {
      const state = this.circuitStates.get(circuit);
      if (state && !state.circuitUsed) {
        state.circuitUsed = true;
        this.logMessage(
          hostname,
          'Circuit used for first time, scheduling automatic updates'
        );
      }
      if (state) {
        state.lastUsed = Date.now();
      }
    }
  }

  /**
   * Clears the circuit for a specific host (or all if hostname is undefined).
   */
  clearCircuit(hostname?: string): void {
    if (hostname === undefined) {
      const hosts = Array.from(this.hostCircuitMap.keys());
      hosts.forEach(h => this.clearCircuit(h));
      return;
    }

    const circuit = this.hostCircuitMap.get(hostname);
    if (circuit) {
      circuit[Symbol.dispose]();

      // Clear ownership tracking
      this.hostCircuitMap.delete(hostname);
      this.circuitOwnershipMap.delete(circuit);
      this.circuitStates.delete(circuit);

      // Cancel timers
      const idleTimer = this.circuitIdleTimers.get(circuit);
      if (idleTimer) {
        this.clock.clearTimeout(idleTimer);
        this.circuitIdleTimers.delete(circuit);
      }
      const updateTimer = this.circuitUpdateTimers.get(circuit);
      if (updateTimer) {
        this.clock.clearTimeout(updateTimer);
        this.circuitUpdateTimers.delete(circuit);
      }

      this.logMessage(hostname, 'Circuit cleared');

      // Trigger buffer refill if needed
      if (this.circuitBufferSize > 0) {
        this.backgroundBufferCircuits().catch(error => {
          this.logMessage(
            'Buffered',
            `Failed to replace cleared circuit: ${getErrorDetails(error)}`,
            'error'
          );
        });
      }
    }
  }

  /**
   * Gets the current circuit status for a specific host or all hosts.
   */
  getCircuitStatus(
    hostname?: string
  ): CircuitStatus | Record<string, CircuitStatus> {
    if (hostname === undefined) {
      // Return status for all allocated hosts
      const result: Record<string, CircuitStatus> = {};
      for (const host of this.hostCircuitMap.keys()) {
        result[host] = this.getCircuitStatusForHost(host);
      }
      // Include buffer status
      result['[buffer]'] = {
        hasCircuit: this.circuitBuffer.length > 0,
        isCreating: this.circuitCreationQueue.size > 0,
        isUpdating: false,
        updateDeadline: 0,
        timeToDeadline: 0,
        updateActive: false,
        nextUpdateIn: null,
        idleTime: 0,
      };
      return result;
    }

    return this.getCircuitStatusForHost(hostname);
  }

  /**
   * Gets status for a specific host's circuit.
   */
  private getCircuitStatusForHost(hostname: string): CircuitStatus {
    const now = Date.now();
    const circuit = this.hostCircuitMap.get(hostname);
    const state = circuit ? this.circuitStates.get(circuit) : undefined;

    if (!state) {
      return {
        hasCircuit: false,
        isCreating: false,
        isUpdating: false,
        updateDeadline: 0,
        timeToDeadline: 0,
        updateActive: false,
        nextUpdateIn: null,
        idleTime: 0,
      };
    }

    return {
      hasCircuit: !!circuit,
      isCreating: this.circuitAllocationTasks.has(hostname) && !circuit,
      isUpdating: state.isUpdatingCircuit,
      updateDeadline: state.updateDeadline,
      timeToDeadline:
        state.updateDeadline > now ? state.updateDeadline - now : 0,
      updateActive: state.updateLoopActive,
      nextUpdateIn:
        state.nextUpdateTime > now ? state.nextUpdateTime - now : null,
      idleTime: state.lastUsed > 0 ? now - state.lastUsed : 0,
    };
  }

  /**
   * Gets a human-readable status string for a circuit.
   */
  getCircuitStatusString(hostname?: string): string | Record<string, string> {
    if (hostname === undefined) {
      const result: Record<string, string> = {};
      for (const host of this.hostCircuitMap.keys()) {
        result[host] = this.getCircuitStatusStringForHost(host);
      }
      result['[buffer]'] =
        `${this.circuitBuffer.length}/${this.circuitBufferSize} ready`;
      return result;
    }

    return this.getCircuitStatusStringForHost(hostname);
  }

  /**
   * Gets a human-readable status string for a specific host's circuit.
   */
  private getCircuitStatusStringForHost(hostname: string): string {
    const status = this.getCircuitStatusForHost(hostname);

    if (!status.hasCircuit && status.isCreating) {
      return 'Creating...';
    }

    if (!status.hasCircuit) {
      return 'None';
    }

    if (status.isUpdating) {
      const timeLeft = Math.ceil(status.timeToDeadline / 1000);
      return `Ready, updating (${timeLeft}s until new circuit required)`;
    }

    if (status.nextUpdateIn !== null && status.nextUpdateIn > 0) {
      const timeLeft = Math.ceil(status.nextUpdateIn / 1000);
      return `Ready (creating next circuit in ${timeLeft}s)`;
    }

    return 'Ready';
  }

  /**
   * Closes the circuit manager, cleaning up all resources.
   */
  close(): void {
    // Stop buffer fill task
    this.bufferFillTaskActive = false;

    // Cancel all circuit creation tasks
    this.circuitCreationQueue.clear();

    // Clear all circuit update timers
    for (const [_circuit, timer] of this.circuitUpdateTimers.entries()) {
      this.clock.clearTimeout(timer);
    }
    this.circuitUpdateTimers.clear();

    // Clear all idle timers
    for (const [_circuit, timer] of this.circuitIdleTimers.entries()) {
      this.clock.clearTimeout(timer);
    }
    this.circuitIdleTimers.clear();

    // Reset scheduling state
    for (const state of this.circuitStates.values()) {
      state.updateLoopActive = false;
      state.circuitUsed = false;
      state.nextUpdateTime = 0;
    }

    // Dispose all buffered circuits
    for (const circuit of this.circuitBuffer) {
      circuit[Symbol.dispose]();
      this.logMessage('Buffered', 'Buffered circuit disposed');
    }
    this.circuitBuffer = [];

    // Dispose all allocated circuits
    for (const [hostname, circuit] of this.hostCircuitMap.entries()) {
      circuit[Symbol.dispose]();
      this.logMessage(hostname, 'Circuit disposed');
    }

    this.hostCircuitMap.clear();
    this.circuitOwnershipMap.clear();
    this.circuitStates.clear();
    this.circuitAllocationTasks.clear();

    // Close the shared Tor connection
    if (this.torConnection) {
      this.torConnection.close();
      this.logMessage('Tor', 'Connection closed');
    }
    this.torConnection = undefined;
    this.torConnectionPromise = undefined;
  }

  /**
   * Symbol.dispose implementation for automatic resource cleanup.
   */
  [Symbol.dispose](): void {
    this.close();
  }

  /**
   * Creates a new unallocated circuit.
   */
  private async createNewCircuit(): Promise<Circuit> {
    await initWasm();

    // Get or create the shared Tor connection
    if (!this.torConnection) {
      if (!this.torConnectionPromise) {
        this.torConnectionPromise = this.createTorConnection();
      }
      this.torConnection = await this.torConnectionPromise;

      // Add error listener to detect connection failures
      this.torConnection.events.on('error', () => {
        this.logMessage(
          'Tor',
          'Connection error detected, will create new connection on next use'
        );
        this.torConnection = undefined;
        this.torConnectionPromise = undefined;
      });

      this.torConnection.events.on('close', () => {
        this.logMessage(
          'Tor',
          'Connection closed, will create new connection on next use'
        );
        this.torConnection = undefined;
        this.torConnectionPromise = undefined;
      });
    }

    const circuit = await this.buildCircuit();

    // Initialize circuit state
    this.circuitStates.set(circuit, {
      allocatedAt: 0,
      allocatedHost: undefined,
      isUpdatingCircuit: false,
      updateDeadline: 0,
      updateTimer: undefined,
      updateLoopActive: false,
      nextUpdateTime: 0,
      circuitUsed: false,
      lastUsed: Date.now(),
    });

    return circuit;
  }

  /**
   * Builds a new circuit through the Tor network.
   */
  private async buildCircuit(): Promise<Circuit> {
    this.logMessage('Buffered', 'Creating circuit');
    const consensusCircuit = await this.torConnection!.createOrThrow();
    this.logMessage(
      'Buffered',
      'Consensus circuit created successfully',
      'success'
    );

    // Get consensus
    const consensus = await this.getConsensus(consensusCircuit);

    this.logMessage('Buffered', 'Filtering relays');
    const middles = consensus.microdescs.filter(isMiddleRelay);
    const exits = consensus.microdescs.filter(isExitRelay);

    this.logMessage(
      'Buffered',
      `Found ${middles.length} middle relays and ${exits.length} exit relays`
    );

    if (middles.length === 0 || exits.length === 0) {
      throw new Error(
        `Not enough suitable relays found: ${middles.length} middles, ${exits.length} exits`
      );
    }

    // Attempt to build circuit with retry
    const maxCircuitAttempts = 10;
    let lastError: unknown;

    for (
      let circuitAttempt = 1;
      circuitAttempt <= maxCircuitAttempts;
      circuitAttempt++
    ) {
      try {
        this.logMessage(
          'Buffered',
          `Building circuit (attempt ${circuitAttempt}/${maxCircuitAttempts})`
        );
        const circuit = await this.torConnection!.createOrThrow();

        // Extend through middle relay
        await this.extendCircuit(circuit, middles, 'middle relay');

        // Extend through exit relay
        await this.extendCircuit(circuit, exits, 'exit relay');

        this.logMessage('Buffered', 'Circuit built successfully!', 'success');
        return circuit;
      } catch (e) {
        lastError = e;
        if (circuitAttempt === maxCircuitAttempts) {
          this.logMessage(
            'Buffered',
            `Circuit build failed after ${maxCircuitAttempts} attempts: ${getErrorDetails(e)}`,
            'error'
          );
        }
      }
    }

    throw new Error(
      `Failed to build circuit after ${maxCircuitAttempts} attempts. Last error: ${getErrorDetails(lastError)}`
    );
  }

  /**
   * Extends a circuit through a randomly selected relay.
   */
  private async extendCircuit(
    circuit: Circuit,
    candidates: Echalote.Consensus.Microdesc.Head[],
    logPrefix: string,
    timeout: number = 10000
  ): Promise<void> {
    if (candidates.length === 0) {
      throw new Error(`No ${logPrefix} candidates available`);
    }

    const candidate = selectRandomElement(candidates);

    try {
      this.logMessage('Buffered', `Extending circuit through ${logPrefix}`);
      const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
        circuit,
        candidate
      );
      await circuit.extendOrThrow(microdesc, AbortSignal.timeout(timeout));
      this.logMessage('Buffered', `Extended through ${logPrefix}`, 'success');
    } catch (e) {
      circuit[Symbol.dispose]();
      throw e;
    }
  }

  /**
   * Schedules automatic circuit updates for a host.
   */
  private scheduleCircuitUpdate(circuit: Circuit, hostname: string) {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      return;
    }

    if (
      this.circuitUpdateInterval === null ||
      this.circuitUpdateInterval <= 0
    ) {
      this.logMessage(hostname, 'Circuit auto-update disabled');
      return;
    }

    if (state.updateLoopActive) {
      this.logMessage(hostname, 'Circuit updates already scheduled');
      return;
    }

    this.logMessage(
      hostname,
      `Scheduled next circuit update in ${this.circuitUpdateInterval}ms with ${this.circuitUpdateAdvance}ms advance`
    );

    state.updateLoopActive = true;

    const updateDelay = this.circuitUpdateInterval! - this.circuitUpdateAdvance;
    state.nextUpdateTime = Date.now() + updateDelay;

    state.updateTimer = this.clock.setTimeout(async () => {
      if (!state.updateLoopActive) {
        return;
      }

      try {
        state.nextUpdateTime = 0;

        this.logMessage(hostname, 'Scheduled circuit update triggered');
        await this.updateCircuit(hostname, this.circuitUpdateAdvance);

        state.updateLoopActive = false;
        state.circuitUsed = false;
      } catch (error) {
        this.logMessage(
          hostname,
          `Scheduled circuit update failed: ${(error as Error).message}`,
          'error'
        );
        state.updateLoopActive = false;
        state.circuitUsed = false;
      }
    }, updateDelay);

    this.circuitUpdateTimers.set(circuit, state.updateTimer);
  }

  /**
   * Schedules idle cleanup for buffered circuits.
   * When a buffered circuit becomes idle, it's replaced.
   */
  private scheduleBufferedCircuitIdleCleanup(circuit: Circuit): void {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      return;
    }

    const timer = this.clock.setTimeout(() => {
      // Check if circuit is still buffered (not allocated to a host)
      if (this.circuitBuffer.includes(circuit)) {
        const idleTime = Date.now() - state.lastUsed;
        this.logMessage(
          'Buffered',
          `Buffered circuit idle for ${Math.round(idleTime / 1000)}s, disposing`
        );

        // Dispose the dead circuit
        circuit[Symbol.dispose]();
        this.circuitStates.delete(circuit);

        // Remove from buffer
        const idx = this.circuitBuffer.indexOf(circuit);
        if (idx >= 0) {
          this.circuitBuffer.splice(idx, 1);
        }

        // Trigger replacement
        this.backgroundBufferCircuits().catch(error => {
          this.logMessage(
            'Buffered',
            `Failed to replace dead circuit: ${getErrorDetails(error)}`,
            'error'
          );
        });
      }

      this.circuitIdleTimers.delete(circuit);
    }, this.circuitIdleTimeout);

    this.circuitIdleTimers.set(circuit, timer);
  }

  private logMessage(
    context: string,
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    const prefix = `[${context}]`;
    const fullMessage = `${prefix} ${message}`;

    switch (type) {
      case 'error':
        this.log.error(fullMessage);
        break;
      case 'success':
      case 'info':
        this.log.info(fullMessage);
        break;
    }
  }
}
