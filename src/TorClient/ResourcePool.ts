import limit from 'p-limit';
import { EventEmitter } from './EventEmitter';
import { IClock } from '../clock/IClock';

/**
 * Factory function type for creating resources.
 * Should throw an error if creation fails.
 */
export type ResourceFactory<R> = () => Promise<R>;

/**
 * Options for ResourcePool constructor.
 */
export interface ResourcePoolOptions<R> {
  /** Function that creates new resources */
  factory: ResourceFactory<R>;
  /** Clock instance for timing (required, use VirtualClock for tests) */
  clock: IClock;
  /** Desired pool size to maintain (default: 0) */
  targetSize?: number;
  /** Minimum number of in-flight creations to maintain during acquire() (default: 0) */
  minInFlightCount?: number;
  /** Optional maximum concurrent creations (default: null = unlimited) */
  concurrencyLimit?: number | null;
  /** Minimum backoff delay in milliseconds (default: 5000) */
  backoffMinMs?: number;
  /** Maximum backoff delay in milliseconds (default: 60000) */
  backoffMaxMs?: number;
  /** Backoff exponential multiplier (default: 1.1) */
  backoffMultiplier?: number;
}

/**
 * Events emitted by ResourcePool.
 */
export type ResourcePoolEvents<R> = {
  'resource-created': (resource: R) => void;
  'resource-disposed': (resource: R) => void;
  'resource-acquired': (resource: R) => void;
  'target-size-reached': () => void;
  'creation-failed': (error: Error, inFlightCount: number) => void;
};

/**
 * A generic resource pool that maintains a target number of resources
 * with automatic background refilling and racing support.
 *
 * Key design:
 * - targetSize: pool proactively maintains this count (overflow allowed)
 * - minInFlightCount: when acquire() is called and buffer is empty, races N creations
 *   in parallel where N = minInFlightCount. First to complete is returned,
 *   others fill the buffer. Errors are dropped. Pool can overfill especially if targetSize=0.
 * - No return() method: resources are one-use (get disposed after use)
 * - Background fill: uses inlined exponential backoff strategy with wholistic in-flight accounting
 * - Implicit deduplication: each acquire/maintenance task creates independently
 * - concurrencyLimit: optional cap on concurrent creation attempts
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class ResourcePool<R> extends EventEmitter<ResourcePoolEvents<R>> {
  private readonly factory: ResourceFactory<R>;
  private readonly targetSize: number;
  private readonly minInFlightCount: number;
  private readonly clock: IClock;
  private readonly concurrencyLimit: ReturnType<typeof limit> | null;

  // Inlined backoff strategy
  private currentDelayMs: number;
  private readonly backoffMinMs: number;
  private readonly backoffMaxMs: number;
  private readonly backoffMultiplier: number;

  private buffered: R[] = [];
  private inFlightCounter: number = 0;
  private disposed: boolean = false;
  private maintenancePromise: Promise<void> | null = null;
  private maintenanceAbortController: AbortController | null = null;

  /**
   * Creates a new resource pool instance.
   *
   * @param options Named parameters object
   */
  constructor(options: ResourcePoolOptions<R>) {
    super();
    this.factory = options.factory;
    this.clock = options.clock;
    this.targetSize = options.targetSize ?? 0;
    this.minInFlightCount = options.minInFlightCount ?? 0;
    this.concurrencyLimit = options.concurrencyLimit
      ? limit(options.concurrencyLimit)
      : null;

    // Inlined backoff strategy initialization
    this.backoffMinMs = options.backoffMinMs ?? 5000;
    this.backoffMaxMs = options.backoffMaxMs ?? 60000;
    this.backoffMultiplier = options.backoffMultiplier ?? 1.1;
    this.currentDelayMs = this.backoffMinMs;

    // Start background maintenance
    this.startMaintenance();
  }

  /**
   * Acquires a resource from the pool. If buffer is empty, waits for one to be created.
   * Returns immediately if a buffered resource is available.
   *
   * When buffer is empty, races minInFlightCount creations in parallel:
   * - Returns whoever finishes first (fastest acquisition)
   * - Other successful creations fill the buffer for future acquires
   * - Errors are silently dropped
   * - Pool can overfill, especially when targetSize=0
   *
   * @throws Error if pool is disposed or resource creation fails
   */
  async acquire(): Promise<R> {
    if (this.disposed) {
      throw new Error('ResourcePool is disposed');
    }

    // Fast path: return buffered resource immediately
    const buffered = this.buffered.shift();
    if (buffered) {
      this.emit('resource-acquired', buffered);
      return buffered;
    }

    // Slow path: buffer is empty, race minInFlightCount creations
    if (this.minInFlightCount > 0) {
      const creationPromises: Promise<R>[] = [];
      for (let i = 0; i < this.minInFlightCount; i++) {
        creationPromises.push(this.createResource());
      }

      // Race them: return first successful, buffer the rest
      const resource = await Promise.race(creationPromises);
      this.emit('resource-acquired', resource);

      // Background: buffer any other successful creations
      Promise.allSettled(creationPromises)
        .then(results => {
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value !== resource) {
              if (!this.disposed) {
                this.buffered.push(result.value);
              } else {
                this.disposeResource(result.value);
              }
            }
            // Errors (result.status === 'rejected') are silently dropped
          }
        })
        .catch(() => {
          // Ignore errors from background buffering task
        });

      return resource;
    }

    // No minimum in-flight, just create one resource
    return await this.createResource();
  }

  /**
   * Waits for the pool to reach target size.
   * Resolves immediately if already at target size.
   * Rejects if pool is disposed or creation permanently fails.
   */
  async waitForFull(): Promise<void> {
    if (this.disposed) {
      throw new Error('ResourcePool is disposed');
    }

    // Already at target size
    if (this.buffered.length >= this.targetSize) {
      this.emit('target-size-reached');
      return;
    }

    // Wait for maintenance to reach target
    // This will emit 'target-size-reached' when achieved
    return new Promise((resolve, reject) => {
      const checkFull = () => {
        if (this.disposed) {
          reject(new Error('ResourcePool disposed while waiting for full'));
          this.off('resource-created', checkFull);
          return;
        }

        if (this.buffered.length >= this.targetSize) {
          resolve();
          this.off('resource-created', checkFull);
        }
      };

      this.on('resource-created', checkFull);
      // Check immediately in case maintenance already filled during listener setup
      checkFull();
    });
  }

  /**
   * Disposes the pool and all buffered resources.
   * No further operations are allowed after disposal.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop maintenance
    if (this.maintenanceAbortController) {
      this.maintenanceAbortController.abort();
    }

    // Dispose all buffered resources
    for (const resource of this.buffered) {
      this.disposeResource(resource);
    }
    this.buffered = [];
  }

  /**
   * Returns the number of buffered resources.
   */
  size(): number {
    return this.buffered.length;
  }

  /**
   * Returns true if the pool has reached target size.
   */
  atTargetSize(): boolean {
    return this.buffered.length >= this.targetSize;
  }

  /**
   * Returns the number of in-flight creation attempts.
   */
  inFlightCount(): number {
    return this.inFlightCounter;
  }

  /**
   * Creates a single resource, handling errors and concurrency limits.
   */
  private async createResource(): Promise<R> {
    const createFn = async () => {
      this.inFlightCounter++;
      try {
        const resource = await this.factory();
        this.inFlightCounter--;
        this.emit('resource-created', resource);
        return resource;
      } catch (error) {
        this.inFlightCounter--;
        const err = error instanceof Error ? error : new Error(String(error));
        this.emit('creation-failed', err, this.inFlightCounter);
        throw err;
      }
    };

    if (this.concurrencyLimit) {
      return await this.concurrencyLimit(createFn);
    } else {
      return await createFn();
    }
  }

  /**
   * Starts background maintenance to keep pool at target size.
   * Runs indefinitely until disposed.
   */
  private startMaintenance(): void {
    if (this.maintenancePromise) {
      return;
    }

    this.maintenanceAbortController = new AbortController();

    this.maintenancePromise = this.maintenanceLoop();
  }

  /**
   * Main loop for background maintenance.
   * Accounts for both buffered resources and in-flight creations when calculating deficit.
   */
  private async maintenanceLoop(): Promise<void> {
    const signal = this.maintenanceAbortController!.signal;

    while (!this.disposed && !signal.aborted) {
      try {
        // Calculate how many more resources we need, accounting for in-flight creations
        // Total "committed" = buffered + in-flight + minimum in-flight from acquire() calls
        // But maintenance contributes to the in-flight count, so we calculate:
        // deficit = targetSize - (buffered + in-flight)
        const deficit =
          this.targetSize - (this.buffered.length + this.inFlightCounter);

        if (deficit <= 0) {
          // At or above target size, just wait a bit before checking again
          try {
            await this.clock.delay(1000);
          } catch {
            // Abort signal fired or clock stopped
            return;
          }
          continue;
        }

        // Try to create missing resources
        // Each creation attempt is independent (no deduplication)
        const promises: Promise<void>[] = [];

        for (let i = 0; i < deficit; i++) {
          if (this.disposed || signal.aborted) {
            break;
          }

          const p = this.createResource()
            .then(resource => {
              if (!this.disposed) {
                this.buffered.push(resource);

                // Emit target-size-reached when we first hit it
                if (
                  this.buffered.length + this.inFlightCounter ===
                  this.targetSize
                ) {
                  this.emit('target-size-reached');
                }
              } else {
                this.disposeResource(resource);
              }
            })
            .catch(() => {
              // Creation failed, backoff will handle retry on next loop iteration
            });

          promises.push(p);
        }

        // Wait for all creation attempts to settle
        await Promise.allSettled(promises);

        // If still under target after attempts, apply backoff
        if (this.buffered.length + this.inFlightCounter < this.targetSize) {
          const delayMs = this.getNextBackoffDelay();
          try {
            await this.clock.delay(delayMs);
          } catch {
            // Abort signal fired or clock stopped
            return;
          }
        } else {
          // Success: reset backoff
          this.resetBackoff();
        }
      } catch {
        // Unexpected error, continue
        if (!this.disposed && !signal.aborted) {
          try {
            await this.clock.delay(1000);
          } catch {
            // Abort signal fired
            return;
          }
        }
      }
    }
  }

  /**
   * Gets the next backoff delay, growing exponentially up to max.
   * Call this after a failure to get the delay before retrying.
   */
  private getNextBackoffDelay(): number {
    const delay = Math.min(this.currentDelayMs, this.backoffMaxMs);

    // Grow for next time
    this.currentDelayMs = Math.min(
      this.currentDelayMs * this.backoffMultiplier,
      this.backoffMaxMs
    );

    return delay;
  }

  /**
   * Resets backoff to minimum delay. Call this on success.
   */
  private resetBackoff(): void {
    this.currentDelayMs = this.backoffMinMs;
  }

  /**
   * Disposes a single resource by calling Symbol.dispose if available.
   */
  private disposeResource(resource: R): void {
    const disposable = resource as unknown as Disposable;
    if (disposable && typeof disposable[Symbol.dispose] === 'function') {
      try {
        disposable[Symbol.dispose]();
        this.emit('resource-disposed', resource);
      } catch {
        // Disposal error, but we already tried
      }
    }
  }
}
