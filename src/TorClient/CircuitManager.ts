import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { getErrorDetails } from '../utils/getErrorDetails';
import { selectRandomElement } from '../utils/random';
import { isMiddleRelay, isExitRelay } from '../utils/relayFilters';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { IClock } from '../clock';

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
  /** Logger instance for hierarchical logging */
  log: Log;
  /** Function to create a Tor connection */
  createTorConnection: () => Promise<TorClientDuplex>;
  /** Function to get the current consensus */
  getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
}

/**
 * Circuit status information
 */
export interface CircuitStatus {
  hasCircuit: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  updateDeadline: number;
  timeToDeadline: number;
  updateActive: boolean;
  nextUpdateIn: number | null;
}

/**
 * Manages Tor circuit lifecycle, including creation, updates, and scheduling.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 * Instances are created by TorClient and should not be instantiated manually.
 */
export class CircuitManager {
  private clock: IClock;
  private circuitUpdateInterval: number | null;
  private circuitUpdateAdvance: number;
  private log: Log;
  private createTorConnection: () => Promise<TorClientDuplex>;
  private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;

  // Circuit state management
  private currentTor?: TorClientDuplex;
  private currentCircuit?: Circuit;
  private circuitPromise?: Promise<Circuit>;
  private isUpdatingCircuit = false;
  private updateDeadline = 0;
  private updateTimer?: unknown;
  private updateLoopActive = false;
  private nextUpdateTime = 0;
  private circuitUsed = false;

  constructor(options: CircuitManagerOptions) {
    this.clock = options.clock;
    this.circuitUpdateInterval = options.circuitUpdateInterval ?? 10 * 60_000; // 10 minutes
    this.circuitUpdateAdvance = options.circuitUpdateAdvance ?? 60_000; // 1 minute
    this.log = options.log;
    this.createTorConnection = options.createTorConnection;
    this.getConsensus = options.getConsensus;
  }

  /**
   * Gets or creates a circuit, managing the lifecycle appropriately.
   */
  async getOrCreateCircuit(): Promise<Circuit> {
    // If we're updating and past the deadline, wait for the new circuit
    if (
      this.isUpdatingCircuit &&
      Date.now() >= this.updateDeadline &&
      this.circuitPromise
    ) {
      this.logMessage('Deadline passed, waiting for new circuit');
      return await this.circuitPromise;
    }

    // If we have a current circuit and we're not updating, or we're within the deadline
    if (
      this.currentCircuit &&
      (!this.isUpdatingCircuit || Date.now() < this.updateDeadline)
    ) {
      return this.currentCircuit;
    }

    // If we're already creating a circuit, wait for it
    if (this.circuitPromise) {
      return await this.circuitPromise;
    }

    // Create new circuit
    this.circuitPromise = this.createCircuitInternal();
    return await this.circuitPromise;
  }

  /**
   * Updates the circuit with a deadline for graceful transition.
   * @param deadline Milliseconds to allow existing requests to use the old circuit. Defaults to 0.
   */
  async updateCircuit(deadline: number = 0): Promise<void> {
    const newDeadline = Date.now() + deadline;

    // Abort any scheduled update since we're manually updating now
    if (this.updateTimer) {
      this.clock.clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
      this.logMessage('Aborted scheduled circuit update due to manual update');
    }

    // Reset scheduling state - next use will trigger new scheduling
    this.updateLoopActive = false;
    this.circuitUsed = false;
    this.nextUpdateTime = 0;

    // If there's already an update in progress, handle it gracefully
    if (this.isUpdatingCircuit) {
      const currentDeadline = this.updateDeadline;
      const moreAggressiveDeadline = Math.min(currentDeadline, newDeadline);

      this.logMessage(
        `Update already in progress. Using more aggressive deadline: ` +
          `${moreAggressiveDeadline - Date.now()}ms (current: ${
            currentDeadline - Date.now()
          }ms, new: ${newDeadline - Date.now()}ms)`
      );

      // Always update to the more aggressive deadline
      this.updateDeadline = moreAggressiveDeadline;

      // Wait for the current update to complete
      this.logMessage(
        'Waiting for current update to complete with updated deadline'
      );
      if (this.circuitPromise) {
        await this.circuitPromise;
      }
      return;
    }

    this.logMessage(`Updating circuit with ${deadline}ms deadline`);

    // Set the update state and deadline
    this.isUpdatingCircuit = true;
    this.updateDeadline = newDeadline;

    try {
      // Start creating the new circuit in the background while keeping the old one
      // The old circuit will continue to serve requests until the deadline
      this.circuitPromise = this.createCircuitInternal();
      await this.circuitPromise;
      this.logMessage('Circuit update completed successfully', 'success');
    } catch (error) {
      this.logMessage(
        `Circuit update failed: ${(error as Error).message}`,
        'error'
      );
      this.isUpdatingCircuit = false;
      this.updateDeadline = 0;
      throw error;
    }
  }

  /**
   * Marks the circuit as used and schedules updates if not already scheduled.
   */
  markCircuitUsed(): void {
    if (!this.circuitUsed) {
      this.circuitUsed = true;
      this.scheduleCircuitUpdate();
      this.logMessage(
        'Circuit used for first time, scheduling automatic updates'
      );
    }
  }

  /**
   * Clears the current circuit (typically on error).
   */
  clearCircuit(): void {
    if (this.currentCircuit) {
      this.currentCircuit[Symbol.dispose]();
      this.currentCircuit = undefined;
      this.currentTor = undefined;
      this.logMessage('Circuit cleared');
    }
  }

  /**
   * Gets the current circuit status information.
   */
  getCircuitStatus(): CircuitStatus {
    const now = Date.now();
    return {
      hasCircuit: !!this.currentCircuit,
      isCreating: !!this.circuitPromise && !this.currentCircuit,
      isUpdating: this.isUpdatingCircuit,
      updateDeadline: this.updateDeadline,
      timeToDeadline: this.updateDeadline > now ? this.updateDeadline - now : 0,
      updateActive: this.updateLoopActive,
      nextUpdateIn:
        this.nextUpdateTime > now ? this.nextUpdateTime - now : null,
    };
  }

  /**
   * Gets a human-readable status string for the current circuit state.
   */
  getCircuitStatusString(): string {
    const status = this.getCircuitStatus();

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
   * Closes the circuit manager, cleaning up resources.
   */
  close(): void {
    // Stop the update loop
    this.updateLoopActive = false;

    // Clear the scheduled update timer
    if (this.updateTimer) {
      this.clock.clearTimeout(this.updateTimer);
      this.updateTimer = undefined;
    }

    // Clear timing state
    this.nextUpdateTime = 0;

    if (this.currentCircuit) {
      this.currentCircuit[Symbol.dispose]();
      this.logMessage('Circuit disposed');
    }

    this.currentCircuit = undefined;
    this.currentTor?.close();
    this.currentTor = undefined;
    this.circuitPromise = undefined;
    this.isUpdatingCircuit = false;
    this.updateDeadline = 0;
    this.circuitUsed = false;
  }

  /**
   * Symbol.dispose implementation for automatic resource cleanup.
   */
  [Symbol.dispose](): void {
    this.close();
  }

  private logMessage(
    message: string,
    type: 'info' | 'success' | 'error' = 'info'
  ): void {
    switch (type) {
      case 'error':
        this.log.error(message);
        break;
      case 'success':
      case 'info':
        this.log.info(message);
        break;
    }
  }

  private async createCircuitInternal(): Promise<Circuit> {
    await initWasm();
    const tor = await this.createTorConnection();
    const circuit = await this.buildCircuit(tor);

    // Clean up old circuit
    if (this.currentCircuit) {
      this.currentCircuit[Symbol.dispose]();
      this.logMessage('Old circuit disposed');
    }

    this.currentTor = tor;
    this.currentCircuit = circuit;
    this.isUpdatingCircuit = false;
    this.circuitPromise = undefined;

    return circuit;
  }

  private async buildCircuit(tor: TorClientDuplex): Promise<Circuit> {
    this.logMessage('Creating circuits');
    const consensusCircuit = await tor.createOrThrow();
    this.logMessage('Consensus circuit created successfully', 'success');

    // Get consensus (from cache if fresh, or fetch if needed)
    const consensus = await this.getConsensus(consensusCircuit);

    this.logMessage('Filtering relays');
    const middles = consensus.microdescs.filter(isMiddleRelay);
    const exits = consensus.microdescs.filter(isExitRelay);

    this.logMessage(
      `Found ${middles.length} middle relays and ${exits.length} exit relays`
    );

    if (middles.length === 0 || exits.length === 0) {
      throw new Error(
        `Not enough suitable relays found: ${middles.length} middles, ${exits.length} exits`
      );
    }

    // Attempt to build a complete circuit with retry logic
    // Since extendOrThrow destroys the circuit on failure, we need to
    // create a fresh circuit for each complete attempt
    const maxCircuitAttempts = 10;
    let lastError: unknown;

    for (
      let circuitAttempt = 1;
      circuitAttempt <= maxCircuitAttempts;
      circuitAttempt++
    ) {
      try {
        this.logMessage(
          `Building circuit (attempt ${circuitAttempt}/${maxCircuitAttempts})`
        );
        const circuit = await tor.createOrThrow();

        // Try to extend through middle relay
        await this.extendCircuit(circuit, middles, 'middle relay');

        // Try to extend through exit relay
        await this.extendCircuit(circuit, exits, 'exit relay');

        this.logMessage('Circuit built successfully!', 'success');
        return circuit;
      } catch (e) {
        lastError = e;
        // Only log details on final attempt
        if (circuitAttempt === maxCircuitAttempts) {
          this.logMessage(
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
   * NOTE: Since circuit.extendOrThrow destroys the circuit on failure,
   * this function will dispose the circuit and throw if extension fails.
   *
   * @param circuit The circuit to extend (will be disposed on failure)
   * @param candidates Array of microdesc candidates to choose from
   * @param logPrefix Prefix for log messages (e.g., "middle relay" or "exit relay")
   * @param timeout Timeout in milliseconds for the extension attempt (default: 10000)
   * @throws Error if extension fails (circuit will be disposed)
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

    // Pick a random candidate
    const candidate = selectRandomElement(candidates);

    try {
      this.logMessage(`Extending circuit through ${logPrefix}`);
      const microdesc = await Echalote.Consensus.Microdesc.fetchOrThrow(
        circuit,
        candidate
      );
      await circuit.extendOrThrow(microdesc, AbortSignal.timeout(timeout));
      this.logMessage(`Extended through ${logPrefix}`, 'success');
    } catch (e) {
      // Circuit is now destroyed, dispose it
      circuit[Symbol.dispose]();
      throw e;
    }
  }

  private scheduleCircuitUpdate() {
    if (
      this.circuitUpdateInterval === null ||
      this.circuitUpdateInterval <= 0
    ) {
      this.logMessage('Circuit auto-update disabled');
      return;
    }

    // If updates are already scheduled, don't schedule again
    if (this.updateLoopActive) {
      this.logMessage('Circuit updates already scheduled');
      return;
    }

    this.logMessage(
      `Scheduled next circuit update in ${this.circuitUpdateInterval}ms with ${this.circuitUpdateAdvance}ms advance`
    );

    // Set the loop as active
    this.updateLoopActive = true;

    // Schedule a single update, not a continuous loop
    const updateDelay = this.circuitUpdateInterval! - this.circuitUpdateAdvance;
    this.nextUpdateTime = Date.now() + updateDelay;

    this.updateTimer = this.clock.setTimeout(async () => {
      // Check if we were disposed during the wait
      if (!this.updateLoopActive) {
        return;
      }

      try {
        // Clear next update time since we're starting the update now
        this.nextUpdateTime = 0;

        this.logMessage('Scheduled circuit update triggered');
        await this.updateCircuit(this.circuitUpdateAdvance);

        // After update completes, reset the scheduling state
        // The next use will trigger scheduling again
        this.updateLoopActive = false;
        this.circuitUsed = false;
      } catch (error) {
        this.logMessage(
          `Scheduled circuit update failed: ${(error as Error).message}`,
          'error'
        );
        // Reset state on error too
        this.updateLoopActive = false;
        this.circuitUsed = false;
      }
    }, updateDelay);
  }
}
