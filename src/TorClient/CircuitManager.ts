import { Circuit, Echalote, TorClientDuplex } from '../echalote';
import { initWasm } from './initWasm';
import { Log } from '../Log';
import { IClock } from '../clock';
import { CircuitBuilder } from './CircuitBuilder';
import { CircuitStateTracker } from './CircuitStateTracker';
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
  /** Maximum lifetime in milliseconds for circuits before disposal, or null to disable (default: 600000 = 10 minutes) */
  maxCircuitLifetime?: number | null;
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
 * Circuit status information for a specific host
 */
export interface CircuitStatus {
  hasCircuit: boolean;
  isCreating: boolean;
  idleTime: number;
}

/**
 * Per-circuit state tracking
 */
interface CircuitState {
  allocatedAt: number; // When allocated to a host (0 if buffered)
  allocatedHost?: string; // Which host owns this circuit
  lifetimeTimer?: unknown; // Timer to dispose circuit at end of lifetime
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
  private maxCircuitLifetime: number | null;
  private circuitBufferSize: number;
  private log: Log;
  private createTorConnection: () => Promise<TorClientDuplex>;
  private getConsensus: (circuit: Circuit) => Promise<Echalote.Consensus>;
  private microdescManager: MicrodescManager;
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

  constructor(options: CircuitManagerOptions) {
    this.clock = options.clock;
    this.maxCircuitLifetime = options.maxCircuitLifetime ?? 10 * 60_000;
    this.circuitBufferSize = options.circuitBuffer ?? 0;
    this.log = options.log;
    this.createTorConnection = options.createTorConnection;
    this.getConsensus = options.getConsensus;
    this.microdescManager = options.microdescManager;
    this.circuitStateTracker = new CircuitStateTracker();

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
   * Gets or creates a circuit for the specified hostname.
   */
  async getOrCreateCircuit(hostname: string): Promise<Circuit> {
    // Check if we already have a circuit for this host
    const existingCircuit = this.hostCircuitMap.get(hostname);
    if (existingCircuit) {
      const state = this.circuitStates.get(existingCircuit);
      if (state) {
        this.circuitStateTracker.markUsed(existingCircuit);
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

    // Allocate to hostname using CircuitStateTracker
    this.circuitStateTracker.allocate(circuit, hostname);

    this.circuitOwnershipMap.set(circuit, hostname);
    this.hostCircuitMap.set(hostname, circuit);

    // Schedule circuit disposal at end of lifetime
    this.scheduleCircuitDisposal(circuit, hostname);

    return circuit;
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

      // Cancel lifetime timer
      const state = this.circuitStates.get(circuit);
      if (state?.lifetimeTimer) {
        this.clock.clearTimeout(state.lifetimeTimer);
      }

      this.log.info(`[${hostname}] Circuit cleared`);
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
        isCreating: this.circuitAllocationTasks.has(hostname),
        idleTime: 0,
      };
    }

    return {
      hasCircuit: !!circuit,
      isCreating: this.circuitAllocationTasks.has(hostname) && !circuit,
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

    return 'Ready';
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
      this.circuitStateTracker.dispose(circuit);
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

      // Initialize circuit state
      this.circuitStateTracker.initialize(circuit);

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
   */
  private scheduleCircuitDisposal(circuit: Circuit, hostname: string) {
    const state = this.circuitStates.get(circuit);
    if (!state) {
      return;
    }

    if (this.maxCircuitLifetime === null || this.maxCircuitLifetime <= 0) {
      this.log.info(`[${hostname}] Circuit lifetime tracking disabled`);
      return;
    }

    this.log.info(
      `[${hostname}] Scheduled circuit disposal in ${this.maxCircuitLifetime}ms`
    );

    state.lifetimeTimer = this.clock.setTimeout(() => {
      this.log.info(`[${hostname}] Circuit reached max lifetime, disposing`);
      this.clearCircuit(hostname);
    }, this.maxCircuitLifetime);
  }
}
