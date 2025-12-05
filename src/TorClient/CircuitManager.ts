import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { IClock } from '../clock';
import { CircuitBuilder } from './CircuitBuilder';
import { CircuitStateTracker } from './CircuitStateTracker';
import { ResourcePool } from './ResourcePool';

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
  private circuitUpdateInterval: number | null;
  private circuitUpdateAdvance: number;
  private circuitBufferSize: number;
  private log: Log;
  private createTorConnection: () => Promise<TorClientDuplex>;
  private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
  private circuitStateTracker: CircuitStateTracker;
  private circuitPool: ResourcePool<Circuit>;

  // Shared Tor connection
  private torConnection?: TorClientDuplex;
  private torConnectionPromise?: Promise<TorClientDuplex>;

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
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000;
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000;
    this.circuitBufferSize = options.circuitBuffer ?? 0;
    this.log = options.log;
    this.createTorConnection = options.createTorConnection;
    this.getConsensus = options.getConsensus;
    this.circuitStateTracker = new CircuitStateTracker();

    // Always initialize ResourcePool for circuit buffering
    // If bufferSize is 0, ResourcePool won't maintain a buffer but still provides acquire()
    this.circuitPool = new ResourcePool<Circuit>({
      factory: async () => await this.createNewCircuit(),
      clock: this.clock,
      targetSize: this.circuitBufferSize,
      minInFlightCount: 2,
    });
  }

  /**
   * Gets or creates a circuit for the specified hostname.
   */
  async getOrCreateCircuit(hostname: string): Promise<Circuit> {
    // Cancel idle timer if circuit exists for this host
    const existingCircuit = this.hostCircuitMap.get(hostname);
    if (existingCircuit) {
      const state = this.circuitStates.get(existingCircuit);
      const trackerState = this.circuitStateTracker.get(existingCircuit);
      if (state && trackerState) {
        const idleTimer = this.circuitIdleTimers.get(existingCircuit);
        if (idleTimer) {
          this.clock.clearTimeout(idleTimer);
          this.circuitIdleTimers.delete(existingCircuit);
        }
        // Update lastUsed via CircuitStateTracker
        this.circuitStateTracker.markUsed(existingCircuit);
      }

      // Handle update deadline logic
      if (
        trackerState?.isUpdating &&
        Date.now() >= trackerState.updateDeadline &&
        this.circuitAllocationTasks.has(hostname)
      ) {
        this.logMessage(hostname, 'Deadline passed, waiting for new circuit');
        return await this.circuitAllocationTasks.get(hostname)!;
      }

      if (
        trackerState &&
        (!trackerState.isUpdating || Date.now() < trackerState.updateDeadline)
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
   * Waits for at least one circuit to be ready (buffered or in-flight creation).
   * Useful for determining when CircuitManager is initialized and ready for use.
   *
   * @throws Error if circuitBuffer is disabled and no circuits are being created
   * @returns Promise that resolves when a circuit is ready
   */
  async waitForCircuitReady(): Promise<void> {
    // Wait for ResourcePool to have at least one circuit ready (targetSize >= 1)
    if (this.circuitBufferSize <= 0) {
      throw new Error(
        'CircuitManager not configured to create circuits (circuitBuffer=0)'
      );
    }
    // Wait for pool to reach target size
    await this.circuitPool.waitForFull();
  }

  /**
   * Allocates a buffered circuit to a host, or creates one if buffer is empty.
   */
  private async allocateCircuitToHost(hostname: string): Promise<Circuit> {
    // Use ResourcePool to acquire a circuit
    const circuit = await this.circuitPool.acquire();
    this.logMessage(hostname, 'Allocated circuit from pool');

    // Allocate to hostname using CircuitStateTracker
    this.circuitStateTracker.allocate(circuit, hostname);

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

    return circuit;
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
    const trackerState = this.circuitStateTracker.get(circuit);
    if (trackerState.isUpdating) {
      const currentDeadline = trackerState.updateDeadline;
      const moreAggressiveDeadline = Math.min(currentDeadline, newDeadline);

      this.logMessage(
        hostname,
        `Update already in progress. Using more aggressive deadline: ` +
          `${moreAggressiveDeadline - Date.now()}ms`
      );

      // Re-mark with more aggressive deadline
      this.circuitStateTracker.markUpdating(circuit, moreAggressiveDeadline);

      if (this.circuitAllocationTasks.has(hostname)) {
        await this.circuitAllocationTasks.get(hostname);
      }
      return;
    }

    this.logMessage(hostname, `Updating circuit with ${deadline}ms deadline`);

    this.circuitStateTracker.markUpdating(circuit, newDeadline);

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
      this.circuitStateTracker.markNotUpdating(circuit);
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
      if (!this.circuitStateTracker.hasBeenUsed(circuit)) {
        this.circuitStateTracker.markUsed(circuit);
        this.logMessage(
          hostname,
          'Circuit used for first time, scheduling automatic updates'
        );
      } else {
        // Just update lastUsed timestamp
        this.circuitStateTracker.markUsed(circuit);
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
      this.circuitStateTracker.dispose(circuit);

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
      // Include pool status
      result['[pool]'] = {
        hasCircuit: this.circuitPool.size() > 0,
        isCreating: this.circuitPool.inFlightCount() > 0,
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
    const trackerState = circuit
      ? this.circuitStateTracker.get(circuit)
      : undefined;
    const state = circuit ? this.circuitStates.get(circuit) : undefined;

    if (!state || !trackerState) {
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
      isUpdating: trackerState.isUpdating,
      updateDeadline: trackerState.updateDeadline,
      timeToDeadline:
        trackerState.updateDeadline > now
          ? trackerState.updateDeadline - now
          : 0,
      updateActive: state.updateLoopActive,
      nextUpdateIn:
        state.nextUpdateTime > now ? state.nextUpdateTime - now : null,
      idleTime: trackerState.lastUsed > 0 ? now - trackerState.lastUsed : 0,
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
      result['[pool]'] =
        `${this.circuitPool.size()}/${this.circuitBufferSize} buffered (${this.circuitPool.inFlightCount()} in-flight)`;
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
    // Dispose ResourcePool (stops maintenance and disposes buffered circuits)
    this.circuitPool.dispose();

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

    // Dispose all allocated circuits
    for (const [hostname, circuit] of this.hostCircuitMap.entries()) {
      circuit[Symbol.dispose]();
      this.circuitStateTracker.dispose(circuit);
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
    this.circuitStateTracker.initialize(circuit);

    return circuit;
  }

  /**
   * Builds a new circuit through the Tor network.
   */
  private async buildCircuit(): Promise<Circuit> {
    // Use CircuitBuilder to build the circuit
    const circuitBuilder = new CircuitBuilder(
      this.torConnection!,
      this.getConsensus,
      this.log.child('CircuitBuilder')
    );
    return await circuitBuilder.buildCircuit();
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
