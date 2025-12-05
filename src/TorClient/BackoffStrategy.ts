import { EventEmitter, EventMap } from './EventEmitter';

/**
 * Events emitted by BackoffStrategy.
 */
export type BackoffStrategyEvents = {
  delay: (delayMs: number) => void;
  reset: () => void;
};

/**
 * Manages exponential backoff strategy for retrying failed operations.
 * Grows delay exponentially up to a maximum, resets on success.
 *
 * @internal This is an internal class and should not be used directly by external consumers.
 */
export class BackoffStrategy extends EventEmitter<BackoffStrategyEvents> {
  private currentDelayMs: number;
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly multiplier: number;
  private lastResetTime: number = 0;

  /**
   * Creates a new backoff strategy instance.
   *
   * @param minMs Minimum delay in milliseconds (default: 5000)
   * @param maxMs Maximum delay in milliseconds (default: 60000)
   * @param multiplier Exponential growth factor (default: 1.1)
   */
  constructor(
    minMs: number = 5000,
    maxMs: number = 60000,
    multiplier: number = 1.1
  ) {
    super();
    this.minDelayMs = minMs;
    this.maxDelayMs = maxMs;
    this.multiplier = multiplier;
    this.currentDelayMs = minMs;
    this.lastResetTime = Date.now();
  }

  /**
   * Gets the next delay to apply, growing exponentially up to max.
   * Call this after a failure to get the delay before retrying.
   * Emits 'delay' event with the calculated delay.
   */
  getNextDelay(): number {
    const delay = Math.min(this.currentDelayMs, this.maxDelayMs);

    // Grow for next time
    this.currentDelayMs = Math.min(
      this.currentDelayMs * this.multiplier,
      this.maxDelayMs
    );

    this.emit('delay', delay);
    return delay;
  }

  /**
   * Gets the current delay without advancing to the next one.
   */
  getCurrentDelay(): number {
    return Math.min(this.currentDelayMs, this.maxDelayMs);
  }

  /**
   * Resets backoff to minimum delay. Call this on success.
   * Emits 'reset' event when resetting.
   */
  reset(): void {
    this.currentDelayMs = this.minDelayMs;
    this.lastResetTime = Date.now();
    this.emit('reset');
  }

  /**
   * Gets the time in milliseconds since last reset.
   */
  getTimeSinceReset(): number {
    return Date.now() - this.lastResetTime;
  }
}
