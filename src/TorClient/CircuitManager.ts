import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { IClock } from '../clock';
import { CircuitBuilder } from './CircuitBuilder';
import { ResourcePool } from './ResourcePool';
import { MicrodescManager } from './MicrodescManager';

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
  /** Maximum lifetime in milliseconds for circuits before disposal (default: 600000 = 10 minutes) */
  maxCircuitLifetime?: number;
  /** Number of circuits to maintain in buffer (default: 0, disabled) */
  circuitBuffer?: number;
  /** Logger instance for hierarchical logging */
  log: Log;
  /** Function to create a Tor connection */
  createTorConnection: () => Promise<TorClientDuplex>;
  /** Function to get the current consensus */
  getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
  /** Manager for microdescriptor caching */
  microdescManager: MicrodescManager;
}

/**
 * Circuit state information tracking all aspects of a circuit's lifecycle.
 *
 * @internal This is an internal interface and should not be used directly by external consumers.
 */
export interface CircuitState {
  /** When allocated to a host (timestamp in milliseconds) */
  allocatedAt: number;
  /** Which host owns this circuit */
  host: string;
  /** Timer to dispose circuit at end of lifetime */
  lifetimeTimer?: unknown;
  /** Last time this circuit was used (timestamp in milliseconds) */
  lastUsed: number;
  /** Whether a circuit exists for this host */
  hasCircuit: boolean;
  /** Whether a circuit is currently being created */
  isCreating: boolean;
  /** Absolute timestamp when circuit will expire (milliseconds) */
  expiry: number;
  /** Reference count for circuit usage (incremented for CircuitManager ownership + active requests) */
  refCount: number;
  /** When the circuit was created (timestamp in milliseconds) */
  createdAt: number;
  /** Timer for 2x lifetime safety check to detect undisposed circuits */
  safetyCheckTimer?: unknown;
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
  private maxCircuitLifetime: number;
  private circuitBufferSize: number;
  private log: Log;
  private createTorConnection: () => Promise<TorClientDuplex>;
  private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
  private microdescManager: MicrodescManager;
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

  constructor(options: CircuitManagerOptions) {
    this.clock = options.clock;
    this.maxCircuitLifetime = options.maxCircuitLifetime ?? 10 * 60_000;
    this.circuitBufferSize = options.circuitBuffer ?? 0;
    this.log = options.log;
    this.createTorConnection = options.createTorConnection;
    this.getConsensus = options.getConsensus;
    this.microdescManager = options.microdescManager;

    // Always initialize ResourcePool for circuit buffering
    // If bufferSize is 0, ResourcePool won't maintain a buffer but still provides acquire()
    this.circuitPool = new ResourcePool<Circuit>({
      factory: async () => await this.createNewCircuit(),
      clock: this.clock,
      targetSize: this.circuitBufferSize,
      minInFlightCount: 2,
      log: this.log.child('pool'), // FIXME: noisy maintenance logs
    });
  }

  /**
   * Increments the reference count for a circuit.
   * Called when CircuitManager acquires the circuit or when a request starts using it.
   */
  private incrementRefCount(circuit: Circuit): void {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      this.log.error(
        `Cannot increment refCount for unknown circuit ${circuit.id}`
      );
      return;
    }
    state.refCount++;
  }

  /**
   * Decrements the reference count for a circuit.
   * When refCount reaches 0, the circuit is disposed.
   * Called when CircuitManager clears the circuit or when a request completes.
   */
  private decrementRefCount(circuit: Circuit): void {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      this.log.error(
        `Cannot decrement refCount for unknown circuit ${circuit.id}`
      );
      return;
    }

    state.refCount--;

    if (state.refCount < 0) {
      this.log.error(
        `Circuit ${circuit.id} refCount went negative (${state.refCount})`
      );
      state.refCount = 0; // Clamp to 0
    }

    if (state.refCount === 0) {
      // Dispose the circuit when refCount hits 0
      const hostname = this.circuitOwnershipMap.get(circuit) || 'unknown';
      this.log.info(
        `[${hostname}] Circuit refCount reached 0, disposing circuit ${circuit.id}`
      );

      // Cancel timers before disposing
      if (state.lifetimeTimer) {
        this.clock.clearTimeout(state.lifetimeTimer);
      }
      if (state.safetyCheckTimer) {
        this.clock.clearTimeout(state.safetyCheckTimer);
      }

      // Actually dispose the circuit
      circuit[Symbol.dispose]();

      // Remove from tracking maps
      this.circuitStates.delete(circuit);
      this.circuitOwnershipMap.delete(circuit);
    }
  }

  /**
   * Gets or creates a circuit for the specified hostname.
   */
  private async getOrCreateCircuit(hostname: string): Promise<Circuit> {
    // Check if we already have a circuit for this host
    const existingCircuit = this.hostCircuitMap.get(hostname);
    if (existingCircuit) {
      const state = this.circuitStates.get(existingCircuit);
      if (state) {
        state.lastUsed = Date.now();
      }
      return existingCircuit;
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
   * Gets or creates a circuit and safely manages its reference count during async operation.
   * The circuit is automatically incremented before calling the callback and decremented after,
   * ensuring safe usage even if the callback throws an error.
   *
   * @param hostname The hostname to allocate a circuit for
   * @param callback Async function that uses the circuit
   * @returns Promise resolving to the callback's return value
   */
  async useCircuit<T>(
    hostname: string,
    callback: (circuit: Circuit) => Promise<T>
  ): Promise<T> {
    const circuit = await this.getOrCreateCircuit(hostname);
    this.incrementRefCount(circuit);

    try {
      return await callback(circuit);
    } finally {
      this.decrementRefCount(circuit);
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
      this.log.error(
        `❌ waitForCircuitReady: CircuitBuffer is disabled (circuitBuffer=${this.circuitBufferSize})`
      );
      throw new Error(
        'CircuitManager not configured to create circuits (circuitBuffer=0)'
      );
    }
    this.log.info(
      `⏳ waitForCircuitReady: Waiting for circuits (target=${this.circuitBufferSize})`
    );
    // Wait for pool to reach target size
    await this.circuitPool.waitForFull();
    this.log.info(`✅ waitForCircuitReady: Circuits ready!`);
  }

  /**
   * Allocates a buffered circuit to a host, or creates one if buffer is empty.
   */
  private async allocateCircuitToHost(hostname: string): Promise<Circuit> {
    let circuit: Circuit;

    if (!hostname.endsWith('.keynet')) {
      // Use ResourcePool to acquire a circuit
      circuit = await this.circuitPool.acquire();
      this.log.info(`[${hostname}] Allocated circuit from pool`);
    } else {
      // keynet circuits are special and can't come from the pool
      circuit = await this.createNewCircuit(hostname);
    }

    // Initialize circuit state
    const now = Date.now();
    this.circuitStates.set(circuit, {
      allocatedAt: now,
      host: hostname,
      lastUsed: now,
      hasCircuit: true,
      isCreating: false,
      expiry: now + this.maxCircuitLifetime,
      refCount: 1, // CircuitManager owns the initial reference
      createdAt: now,
    });

    this.circuitOwnershipMap.set(circuit, hostname);
    this.hostCircuitMap.set(hostname, circuit);

    // Schedule circuit disposal at end of lifetime
    this.scheduleCircuitDisposal(circuit, hostname);

    return circuit;
  }

  /**
   * Clears the circuit for a specific host (or all if hostname is undefined).
   * This removes CircuitManager's reference to the circuit. If no active requests
   * are using it, the circuit will be disposed immediately. Otherwise, it will be
   * disposed when the last active request completes.
   */
  clearCircuit(hostname?: string): void {
    if (hostname === undefined) {
      const hosts = Array.from(this.hostCircuitMap.keys());
      hosts.forEach(h => this.clearCircuit(h));
      return;
    }

    const circuit = this.hostCircuitMap.get(hostname);
    if (circuit) {
      // Remove from ownership tracking
      this.hostCircuitMap.delete(hostname);

      // Cancel lifetime timer before decrementing
      const state = this.circuitStates.get(circuit);
      if (state?.lifetimeTimer) {
        this.clock.clearTimeout(state.lifetimeTimer);
        state.lifetimeTimer = undefined;
      }

      // Decrement CircuitManager's reference
      // This may trigger disposal if refCount reaches 0
      this.decrementRefCount(circuit);

      this.log.info(`[${hostname}] Circuit cleared`);
    }
  }

  /**
   * Gets the current circuit state for a specific host or all hosts.
   */
  getCircuitState(
    hostname?: string
  ): CircuitState | Record<string, CircuitState> {
    if (hostname === undefined) {
      // Return state for all allocated hosts
      const result: Record<string, CircuitState> = {};
      for (const host of this.hostCircuitMap.keys()) {
        result[host] = this.getCircuitStateForHost(host);
      }
      // Include pool state
      result['[pool]'] = {
        allocatedAt: 0,
        host: '[pool]',
        lastUsed: 0,
        hasCircuit: this.circuitPool.size() > 0,
        isCreating: this.circuitPool.inFlightCount() > 0,
        expiry: 0,
        refCount: 0,
        createdAt: 0,
      };
      return result;
    }

    return this.getCircuitStateForHost(hostname);
  }

  /**
   * Gets state for a specific host's circuit.
   */
  private getCircuitStateForHost(hostname: string): CircuitState {
    const circuit = this.hostCircuitMap.get(hostname);
    const state = circuit ? this.circuitStates.get(circuit) : undefined;

    if (!state) {
      return {
        allocatedAt: 0,
        host: hostname,
        lastUsed: 0,
        hasCircuit: false,
        isCreating: this.circuitAllocationTasks.has(hostname),
        expiry: 0,
        refCount: 0,
        createdAt: 0,
      };
    }

    return state;
  }

  /**
   * Gets a human-readable status string for a circuit.
   */
  getCircuitStateString(hostname?: string): string | Record<string, string> {
    if (hostname === undefined) {
      const result: Record<string, string> = {};
      for (const host of this.hostCircuitMap.keys()) {
        result[host] = this.getCircuitStateStringForHost(host);
      }
      result['[pool]'] =
        `${this.circuitPool.size()}/${this.circuitBufferSize} buffered (${this.circuitPool.inFlightCount()} in-flight)`;
      return result;
    }

    return this.getCircuitStateStringForHost(hostname);
  }

  /**
   * Gets a human-readable status string for a specific host's circuit.
   */
  private getCircuitStateStringForHost(hostname: string): string {
    const state = this.getCircuitStateForHost(hostname);

    if (!state.hasCircuit && state.isCreating) {
      return 'Creating...';
    }

    if (!state.hasCircuit) {
      return 'None';
    }

    const msToExpiry = Math.max(0, state.expiry - Date.now());
    const expirySeconds = Math.ceil(msToExpiry / 1000);
    return `Ready (${expirySeconds}s to expiry)`;
  }

  /**
   * Closes the circuit manager, cleaning up all resources.
   */
  close(): void {
    // Dispose ResourcePool (stops maintenance and disposes buffered circuits)
    this.circuitPool.dispose();

    // Dispose all allocated circuits and cancel their timers
    for (const [hostname, circuit] of this.hostCircuitMap.entries()) {
      const state = this.circuitStates.get(circuit);
      if (state?.lifetimeTimer) {
        this.clock.clearTimeout(state.lifetimeTimer);
      }
      circuit[Symbol.dispose]();
      this.log.info(`[${hostname}] Circuit disposed`);
    }

    this.hostCircuitMap.clear();
    this.circuitOwnershipMap.clear();
    this.circuitStates.clear();
    this.circuitAllocationTasks.clear();

    // Close the shared Tor connection
    if (this.torConnection) {
      this.torConnection.close();
      this.log.info(`[Tor] Connection closed`);
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
  private async createNewCircuit(hostname?: string): Promise<Circuit> {
    const hostLabel = hostname || 'buffered';
    this.log.info(`[${hostLabel}] 🚀 Creating new circuit`);

    try {
      await initWasm();

      // Get or create the shared Tor connection
      if (!this.torConnection) {
        if (!this.torConnectionPromise) {
          this.log.info(`[${hostLabel}] 🔌 Creating shared Tor connection`);
          this.torConnectionPromise = this.createTorConnection();
        }
        this.torConnection = await this.torConnectionPromise;

        // Add error listener to detect connection failures
        this.torConnection.events.on('error', () => {
          this.log.info(
            `[Tor] Connection error detected, will create new connection on next use`
          );
          this.torConnection = undefined;
          this.torConnectionPromise = undefined;
        });

        this.torConnection.events.on('close', () => {
          this.log.info(
            `[Tor] Connection closed, will create new connection on next use`
          );
          this.torConnection = undefined;
          this.torConnectionPromise = undefined;
        });
      }

      this.log.info(`[${hostLabel}] 🔨 Building circuit`);
      const circuit = await this.buildCircuit(hostname);

      this.log.info(`[${hostLabel}] ✅ Circuit created successfully`);
      return circuit;
    } catch (error) {
      this.log.error(
        `[${hostLabel}] ❌ Circuit creation failed: ${(error as Error).message}`
      );
      throw error;
    }
  }

  /**
   * Builds a new circuit through the Tor network.
   */
  private async buildCircuit(hostname?: string): Promise<Circuit> {
    // Use CircuitBuilder to build the circuit
    const circuitBuilder = new CircuitBuilder(
      this.torConnection!,
      this.getConsensus,
      this.log.child('CircuitBuilder'),
      this.microdescManager
    );
    return await circuitBuilder.buildCircuit(hostname);
  }

  /**
   * Schedules disposal of a circuit at the end of its lifetime.
   * Also sets a 2x lifetime safety check to detect if circuit wasn't disposed.
   */
  private scheduleCircuitDisposal(circuit: Circuit, hostname: string) {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      return;
    }

    this.log.info(
      `[${hostname}] Scheduled circuit disposal in ${this.maxCircuitLifetime}ms`
    );

    state.lifetimeTimer = this.clock.setTimeout(() => {
      this.log.info(`[${hostname}] Circuit reached max lifetime, disposing`);
      this.clearCircuit(hostname);
    }, this.maxCircuitLifetime);

    // Schedule a safety check at 2x lifetime to detect undisposed circuits
    const safetyCheckDelay = this.maxCircuitLifetime * 2;
    state.safetyCheckTimer = this.clock.setTimeout(() => {
      // At this point, the circuit should have been disposed
      // Check if it still exists and hasn't been closed
      if (!circuit.closed) {
        this.log.error(
          `[${hostname}] Circuit ${circuit.id} was not disposed after 2x lifetime (${safetyCheckDelay}ms)`
        );
      }
    }, safetyCheckDelay);
  }
}
