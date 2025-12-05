import { IClock } from './IClock';

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }

  delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this.setTimeout(resolve, ms);
    });
  }

  delayUnref(ms: number): Promise<void> {
    return new Promise(resolve => {
      const timerId = this.setTimeout(resolve, ms);
      this.unref(timerId);
    });
  }

  setTimeout(callback: () => void, delay: number): unknown {
    return setTimeout(callback, delay);
  }

  clearTimeout(timerId: unknown): void {
    clearTimeout(timerId as NodeJS.Timeout);
  }

  setInterval(callback: () => void, interval: number): unknown {
    return setInterval(callback, interval);
  }

  clearInterval(timerId: unknown): void {
    clearInterval(timerId as NodeJS.Timeout);
  }

  unref(timerId: unknown): void {
    const timer = timerId as { unref?: () => void };
    if (timer && typeof timer.unref === 'function') {
      timer.unref(); // Node.js
    }
    // Browser: no-op (setTimeout returns number, not object)
  }

  ref(timerId: unknown): void {
    const timer = timerId as { ref?: () => void };
    if (timer && typeof timer.ref === 'function') {
      timer.ref(); // Node.js
    }
    // Browser: no-op
  }
}
