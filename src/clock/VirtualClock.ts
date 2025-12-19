import { IClock } from './IClock';
import { Log } from '../Log';
import { assert } from '../utils/assert.js';

interface Timer {
  id: number;
  executeTime: number;
  callback: () => void;
  actualCallback?: () => void;
  interval?: number;
  refed: boolean;
}

interface VirtualClockOptions {
  automated?: boolean;
  startTime?: number;
  log?: Log;
}

export class VirtualClock implements IClock {
  private currentTime: number;
  private timers: Map<number, Timer>;
  private nextId: number;
  private automated: boolean;
  private running: boolean;
  private stopRequested: boolean;
  private log?: Log;
  private autoRunPromise?: Promise<void>;
  private storedError?: Error;

  constructor(options: VirtualClockOptions = {}) {
    this.currentTime = options.startTime ?? 0;
    this.timers = new Map();
    this.nextId = 1;
    this.automated = options.automated ?? false;
    this.running = false;
    this.stopRequested = false;
    this.log = options.log;
  }

  now(): number {
    return this.currentTime;
  }

  isRunning(): boolean {
    return this.running;
  }

  isAutomated(): boolean {
    return this.automated;
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.setTimeout(() => resolve(), ms);
    });
  }

  delayUnref(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timerId = this.setTimeout(() => resolve(), ms);
      this.unref(timerId);
    });
  }

  setTimeout(callback: () => void, delay: number): unknown {
    if (this.storedError) {
      throw new Error(
        `Cannot schedule timers after error: ${this.storedError.message}`
      );
    }

    const id = this.nextId++;
    const timer: Timer = {
      id,
      executeTime: this.currentTime + delay,
      actualCallback: callback,
      callback: () => {
        // Schedule callback as macrotask (for manual mode or non-automated execution)
        setTimeout(callback, 0);
      },
      refed: true, // Default to refed (matching Node.js behavior)
    };

    this.timers.set(id, timer);

    // In automated mode, ensure auto-execution starts
    if (this.automated) {
      this.ensureAutoRun();
    }

    return id;
  }

  clearTimeout(timerId: unknown): void {
    this.timers.delete(timerId as number);
  }

  setInterval(callback: () => void, interval: number): unknown {
    if (this.storedError) {
      throw new Error(
        `Cannot schedule timers after error: ${this.storedError.message}`
      );
    }

    const id = this.nextId++;
    const timer: Timer = {
      id,
      executeTime: this.currentTime + interval,
      actualCallback: callback,
      callback: () => {
        // Schedule callback as macrotask (for manual mode or non-automated execution)
        setTimeout(callback, 0);
      },
      interval,
      refed: true, // Default to refed (matching Node.js behavior)
    };

    this.timers.set(id, timer);

    // In automated mode, ensure auto-execution starts
    if (this.automated) {
      this.ensureAutoRun();
    }

    return id;
  }

  clearInterval(timerId: unknown): void {
    this.timers.delete(timerId as number);
  }

  async advanceTime(amount: number): Promise<void> {
    assert(!this.automated, 'Cannot manually advance time in automated mode');

    const targetTime = this.currentTime + amount;
    await this.executeTimersUntil(targetTime);
  }

  private async executeTimersUntil(targetTime: number): Promise<void> {
    while (this.currentTime <= targetTime) {
      const nextTimers = Array.from(this.timers.values())
        .filter(timer => timer.executeTime <= targetTime)
        .sort((a, b) => a.executeTime - b.executeTime);

      if (nextTimers.length === 0) {
        this.currentTime = targetTime;
        break;
      }

      const nextTimer = nextTimers[0];
      this.currentTime = nextTimer.executeTime;

      const timer = this.timers.get(nextTimer.id);
      if (!timer) continue;

      this.timers.delete(timer.id);

      try {
        timer.callback();
        // Allow macrotasks to execute
        await new Promise(resolve => setTimeout(resolve, 0));
      } catch (error) {
        this.log?.error(
          `Timer callback error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      if (timer.interval) {
        const newTimer: Timer = {
          id: timer.id,
          executeTime: this.currentTime + timer.interval,
          callback: timer.callback,
          actualCallback: timer.actualCallback,
          interval: timer.interval,
          refed: timer.refed, // Preserve ref state for recurring timers
        };
        this.timers.set(timer.id, newTimer);
      }

      if (this.stopRequested) {
        this.stopRequested = false;
        break;
      }
    }
  }

  private ensureAutoRun(): void {
    if (this.autoRunPromise || !this.automated) {
      return;
    }

    this.autoRunPromise = this.performAutoRun();
  }

  private async performAutoRun(): Promise<void> {
    // Defer to next macrotask to allow more timers to be scheduled in current turn
    await new Promise(resolve => setTimeout(resolve, 0));

    try {
      while (this.timers.size > 0 && !this.stopRequested) {
        const refedTimers = Array.from(this.timers.values()).filter(
          timer => timer.refed
        );

        // Exit if only unref'd timers remain
        if (refedTimers.length === 0) break;

        const nextTimers = refedTimers.sort(
          (a, b) => a.executeTime - b.executeTime
        );

        if (nextTimers.length === 0) break;

        const nextTimer = nextTimers[0];
        this.currentTime = nextTimer.executeTime;

        const timer = this.timers.get(nextTimer.id);
        if (!timer) continue;

        this.timers.delete(timer.id);

        try {
          // Execute the actual callback directly (not wrapped in setTimeout)
          if (timer.actualCallback) {
            timer.actualCallback();
          } else {
            timer.callback();
          }
        } catch (error) {
          // Store error and stop auto-execution
          this.storedError =
            error instanceof Error ? error : new Error(String(error));
          this.log?.error(`Timer callback error: ${this.storedError.message}`);
          break;
        }

        if (timer.interval) {
          const newTimer: Timer = {
            id: timer.id,
            executeTime: this.currentTime + timer.interval,
            callback: timer.callback,
            actualCallback: timer.actualCallback,
            interval: timer.interval,
            refed: timer.refed,
          };
          this.timers.set(timer.id, newTimer);
        }

        // Yield to event loop after each timer
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    } finally {
      this.autoRunPromise = undefined;
      this.running = false;
      this.stopRequested = false;
    }
  }

  async wait(): Promise<void> {
    assert(this.automated, 'Cannot wait in manual mode');

    if (this.storedError) {
      throw this.storedError;
    }

    // Wait for auto-execution to complete
    if (this.autoRunPromise) {
      await this.autoRunPromise;
    }

    // Re-throw if error occurred during auto-execution
    if (this.storedError) {
      throw this.storedError;
    }
  }

  stop(): void {
    if (!this.automated) {
      return;
    }

    this.stopRequested = true;
  }

  unref(timerId: unknown): void {
    const timer = this.timers.get(timerId as number);
    if (timer) {
      timer.refed = false;
    }
  }

  ref(timerId: unknown): void {
    const timer = this.timers.get(timerId as number);
    if (timer) {
      timer.refed = true;
    }
  }
}
