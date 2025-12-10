import limit from 'p-limit';
import { IClock } from '../clock/IClock';
import { Log } from '../Log';
import { EventEmitter } from './EventEmitter';

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
  /** Logger instance for diagnostics */
  log: Log;
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
  update(): void;
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
 * - Background fill: uses exponential backoff with net delay calculation
 * - Implicit deduplication: concurrent acquires intelligently share in-flight creations
 * - concurrencyLimit: optional cap on concurrent creation attempts
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class ResourcePool<R> extends EventEmitter<ResourcePoolEvents<R>> {
  private pool: R[] = [];
  private inFlight: Promise<R>[] = [];
  private disposed: boolean = false;
  private maintenanceAbortController: AbortController | null = null;
  private targetSizeReachedEmitted: boolean = false;

  // Backoff state
  private failCount: number = 0;
  private lastFailTime: number = 0;

  // Options
  private readonly factory: ResourceFactory<R>;
  private readonly clock: IClock;
  private readonly log: Log;
  private readonly targetSize: number;
  private readonly minInFlightCount: number;
  private readonly concurrencyLimit: ReturnType<typeof limit> | null;
  private readonly backoffMinMs: number;
  private readonly backoffMaxMs: number;
  private readonly backoffMultiplier: number;

  constructor(options: ResourcePoolOptions<R>) {
    super();
    this.factory = options.factory;
    this.clock = options.clock;
    this.log = options.log;
    this.targetSize = options.targetSize ?? 0;
    this.minInFlightCount = options.minInFlightCount ?? 0;
    this.concurrencyLimit = options.concurrencyLimit
      ? limit(options.concurrencyLimit)
      : null;
    this.backoffMinMs = options.backoffMinMs ?? 5000;
    this.backoffMaxMs = options.backoffMaxMs ?? 60000;
    this.backoffMultiplier = options.backoffMultiplier ?? 1.1;
    this.lastFailTime = this.clock.now();

    // Start background maintenance
    this.maintenanceAbortController = new AbortController();
    this.maintenanceLoop();
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
   */
  async pop(): Promise<R> {
    if (this.disposed) {
      throw new Error('ResourcePool is disposed');
    }

    this.ensureInFlight();

    while (this.pool.length === 0) {
      await this.nextUpdate();
    }

    const r = this.pool.shift();
    if (!r) throw new Error('Unexpected: pool should have a resource');

    this.emit('resource-acquired', r);
    this.emitUpdate();

    return r;
  }

  /**
   * Alias for pop() to maintain backward compatibility with original API
   */
  async acquire(): Promise<R> {
    return this.pop();
  }

  /**
   * Waits for the pool to reach target size.
   * Resolves immediately if already at target size.
   */
  async waitForFull(): Promise<void> {
    if (this.disposed) {
      throw new Error('ResourcePool is disposed');
    }

    if (this.pool.length >= this.targetSize) {
      this.log?.info?.(
        `⏭️  waitForFull: Already at target size (pool=${this.pool.length}, target=${this.targetSize})`
      );
      this.emit('target-size-reached');
      return;
    }

    this.log?.info?.(
      `⏳ waitForFull: Starting wait for target size (pool=${this.pool.length}, target=${this.targetSize})`
    );

    return new Promise((resolve, reject) => {
      const checkFull = () => {
        this.log?.info?.(
          `🔍 waitForFull: checkFull called (pool=${this.pool.length}, target=${this.targetSize})`
        );

        if (this.disposed) {
          this.log?.error?.('❌ waitForFull: Pool disposed while waiting');
          reject(new Error('ResourcePool disposed while waiting for full'));
          this.off('resource-created', checkFull);
          return;
        }

        if (this.pool.length >= this.targetSize) {
          this.log?.info?.(
            `✅ waitForFull: Target size reached (pool=${this.pool.length})`
          );
          resolve();
          this.off('resource-created', checkFull);
        }
      };

      this.on('resource-created', checkFull);
      checkFull();
    });
  }

  /**
   * Disposes the pool and all buffered resources.
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    if (this.maintenanceAbortController) {
      this.maintenanceAbortController.abort();
    }

    for (const resource of this.pool) {
      this.disposeResource(resource);
    }
    this.pool = [];
  }

  /**
   * Returns the number of buffered resources.
   */
  size(): number {
    return this.pool.length;
  }

  /**
   * Returns true if the pool has reached target size.
   */
  atTargetSize(): boolean {
    return this.pool.length >= this.targetSize;
  }

  /**
   * Returns the number of in-flight creation attempts.
   */
  inFlightCount(): number {
    return this.inFlight.length;
  }

  // ==================== Private Implementation ====================

  private ensureInFlight() {
    if (this.pool.length > 0) {
      return;
    }

    while (this.inFlight.length < this.minInFlightCount) {
      this.pushInFlight();
    }
  }

  private pushInFlight() {
    const createFn = async () => {
      // Apply backoff if we've had failures
      if (this.failCount > 0) {
        const timeElapsed = this.clock.now() - this.lastFailTime;
        let totalDelay =
          this.backoffMinMs * this.backoffMultiplier ** this.failCount;

        if (totalDelay > this.backoffMaxMs) {
          totalDelay = this.backoffMaxMs;
        }

        const netDelay = totalDelay - timeElapsed;

        if (netDelay > 0) {
          await this.clock.delay(netDelay);
        }
      }

      return this.factory();
    };

    const p = this.concurrencyLimit
      ? this.concurrencyLimit(createFn)
      : createFn();

    this.inFlight.push(p);

    p.then(
      r => {
        this.inFlight = this.inFlight.filter(inFlightP => inFlightP !== p);
        this.pool.push(r);
        this.failCount = 0;
        this.emit('resource-created', r);
        this.checkTargetSizeReached();
        this.emitUpdate();
      },
      e => {
        this.failCount++;
        this.lastFailTime = this.clock.now();
        this.inFlight = this.inFlight.filter(inFlightP => inFlightP !== p);
        const err = e instanceof Error ? e : new Error(String(e));
        this.emit('creation-failed', err, this.inFlight.length);
        this.log?.error?.(`Creation failed: ${err.message}`);
        this.emitUpdate();
      }
    );
  }

  private checkTargetSizeReached() {
    if (
      this.targetSize > 0 &&
      this.pool.length >= this.targetSize &&
      !this.targetSizeReachedEmitted
    ) {
      this.targetSizeReachedEmitted = true;
      this.emit('target-size-reached');
    }
  }

  private async nextUpdate() {
    return new Promise<void>(resolve => {
      this.once('update', resolve);
    });
  }

  private emitUpdate() {
    this.emit('update');
  }

  private maintenanceLoop() {
    const signal = this.maintenanceAbortController!.signal;
    (async () => {
      while (!this.disposed && !signal.aborted) {
        try {
          // Reset flag if we drop below target (so we can emit again)
          if (
            this.targetSize > 0 &&
            this.pool.length + this.inFlight.length < this.targetSize &&
            this.targetSizeReachedEmitted
          ) {
            this.targetSizeReachedEmitted = false;
          }

          while (
            !this.disposed &&
            !signal.aborted &&
            this.pool.length + this.inFlight.length < this.targetSize
          ) {
            this.pushInFlight();
          }

          try {
            await this.nextUpdate();
          } catch {
            // Abort signal fired
            return;
          }
        } catch (error) {
          this.log?.error?.(
            `❌ maintenanceLoop: Unexpected error: ${error instanceof Error ? error.message : String(error)}`
          );
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
    })();
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
