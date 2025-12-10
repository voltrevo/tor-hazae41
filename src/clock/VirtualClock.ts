import { IClock } from './IClock';
import { Log } from '../Log';
import { assert } from '../utils/assert.js';

interface Timer {
  id: number;
  executeTime: number;
  callback: () => void;
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
    const id = this.nextId++;
    const timer: Timer = {
      id,
      executeTime: this.currentTime + delay,
      callback: () => {
        // Schedule callback as macrotask
        setTimeout(callback, 0);
      },
      refed: true, // Default to refed (matching Node.js behavior)
    };

    this.timers.set(id, timer);

    return id;
  }

  clearTimeout(timerId: unknown): void {
    this.timers.delete(timerId as number);
  }

  setInterval(callback: () => void, interval: number): unknown {
    const id = this.nextId++;
    const timer: Timer = {
      id,
      executeTime: this.currentTime + interval,
      callback: () => {
        // Schedule callback as macrotask
        setTimeout(callback, 0);
      },
      interval,
      refed: true, // Default to refed (matching Node.js behavior)
    };

    this.timers.set(id, timer);

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

  async run(): Promise<void> {
    assert(this.automated, 'Cannot run manual clock in automated mode');

    if (this.running) {
      return;
    }

    this.running = true;
    this.stopRequested = false;

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
        timer.callback();
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
          interval: timer.interval,
          refed: timer.refed, // Preserve ref state for recurring timers
        };
        this.timers.set(timer.id, newTimer);
      }

      await new Promise(resolve => setTimeout(resolve, 0));
    }

    this.running = false;
  }

  stop(): void {
    if (!this.automated || !this.running) {
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
