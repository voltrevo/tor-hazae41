import { IClock } from '../clock/IClock';
import { SystemClock } from '../clock/SystemClock';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Re-export for convenience
export type { LogLevel as LogLevelType };

interface LogConstructorParams {
  clock?: IClock;
  rawLog?: (level: LogLevel, ...args: unknown[]) => void;
  parentStartTime?: number;
  namePrefix?: string;
}

/**
 * A hierarchical logging system with timestamps relative to root logger creation.
 *
 * Usage:
 * ```typescript
 * const log = new Log();
 * log.debug("Hello");                    // [00.000] Hello
 * log.warn("Something", { data: 123 }); // [00.123] Something { data: 123 }
 *
 * const child = log.child("mymodule");
 * child.error("Error!");                 // [00.456] [mymodule] Error!
 *
 * const grandchild = child.child("component");
 * grandchild.info("Info");               // [00.789] [mymodule.component] Info
 * ```
 */
export class Log {
  private clock: IClock;
  private rawLog: (level: LogLevel, ...args: unknown[]) => void;
  private parentStartTime: number;
  private namePrefix: string;

  constructor(params: LogConstructorParams = {}) {
    this.clock = params.clock ?? new SystemClock();
    this.parentStartTime = params.parentStartTime ?? this.clock.now();
    this.namePrefix = params.namePrefix ?? '';

    if (params.rawLog) {
      this.rawLog = params.rawLog;
    } else {
      this.rawLog = this.defaultRawLog.bind(this);
    }
  }

  /**
   * Create a child logger with a prefixed name.
   * Multiple calls to child() create new instances (not memoized).
   */
  child(name: string): Log {
    const newPrefix = this.namePrefix ? `${this.namePrefix}.${name}` : name;
    return new Log({
      clock: this.clock,
      rawLog: this.rawLog,
      parentStartTime: this.parentStartTime,
      namePrefix: newPrefix,
    });
  }

  debug(...args: unknown[]): void {
    this.log('debug', ...args);
  }

  info(...args: unknown[]): void {
    this.log('info', ...args);
  }

  warn(...args: unknown[]): void {
    this.log('warn', ...args);
  }

  error(...args: unknown[]): void {
    this.log('error', ...args);
  }

  private log(level: LogLevel, ...args: unknown[]): void {
    const elapsed = this.clock.now() - this.parentStartTime;
    const timestamp = this.formatTimestamp(elapsed);

    let allArgs: unknown[];
    if (this.namePrefix) {
      allArgs = [`[${timestamp}]`, `[${this.namePrefix}]`, ...args];
    } else {
      allArgs = [`[${timestamp}]`, ...args];
    }

    this.rawLog(level, ...allArgs);
  }

  /**
   * Format elapsed milliseconds as a relative timestamp.
   *
   * Format depends on elapsed time:
   * - SS.mmm (seconds) e.g., "07.138"
   * - MM:SS.mmm (minutes) e.g., "05:07.138"
   * - HH:MM:SS.mmm (hours) e.g., "01:05:07.138"
   * - Xd HH:MM:SS.mmm (days) e.g., "3d 01:05:07.138"
   */
  private formatTimestamp(elapsedMs: number): string {
    const totalSeconds = Math.floor(elapsedMs / 1000);
    const milliseconds = elapsedMs % 1000;

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const ms = String(milliseconds).padStart(3, '0');

    if (days > 0) {
      const h = String(hours).padStart(2, '0');
      const m = String(minutes).padStart(2, '0');
      const s = String(seconds).padStart(2, '0');
      return `${days}d ${h}:${m}:${s}.${ms}`;
    }

    if (hours > 0) {
      const h = String(hours).padStart(2, '0');
      const m = String(minutes).padStart(2, '0');
      const s = String(seconds).padStart(2, '0');
      return `${h}:${m}:${s}.${ms}`;
    }

    if (minutes > 0) {
      const m = String(minutes).padStart(2, '0');
      const s = String(seconds).padStart(2, '0');
      return `${m}:${s}.${ms}`;
    }

    const s = String(seconds).padStart(2, '0');
    return `${s}.${ms}`;
  }

  private defaultRawLog(level: LogLevel, ...args: unknown[]): void {
    const consoleMethod = this.getConsoleMethod(level);
    consoleMethod(...args);
  }

  private getConsoleMethod(level: LogLevel): (...args: unknown[]) => void {
    switch (level) {
      case 'debug':
        return console.debug;
      case 'info':
        return console.info;
      case 'warn':
        return console.warn;
      case 'error':
        return console.error;
    }
  }
}
