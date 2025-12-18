import { test, expect } from 'vitest';
import { Log, LogLevel } from '.';
import { VirtualClock } from '../clock/VirtualClock';

test('Log - basic debug logging', async () => {
  const logs: unknown[][] = [];
  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (_level: LogLevel, ...args: unknown[]) => {
      if (_level === 'debug') logs.push(args);
    },
  });

  log.debug('test message');
  expect(logs.length === 1).toBe(true);
  expect(String(logs[0][0]).includes('[00.000]')).toBe(true);
  expect(String(logs[0][1]) === 'test message').toBe(true);
});

test('Log - basic info logging', async () => {
  const logs: unknown[][] = [];
  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (_level: LogLevel, ...args: unknown[]) => {
      if (_level === 'info') logs.push(args);
    },
  });

  log.info('info message');
  expect(logs.length === 1).toBe(true);
});

test('Log - basic warn logging', async () => {
  const logs: unknown[][] = [];
  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (_level: LogLevel, ...args: unknown[]) => {
      if (_level === 'warn') logs.push(args);
    },
  });

  log.warn('warn message');
  expect(logs.length === 1).toBe(true);
});

test('Log - basic error logging', async () => {
  const logs: unknown[][] = [];
  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (_level: LogLevel, ...args: unknown[]) => {
      if (_level === 'error') logs.push(args);
    },
  });

  log.error('error message');
  expect(logs.length === 1).toBe(true);
});

test('Log - multiple arguments', async () => {
  const logs: unknown[][] = [];
  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (_level: LogLevel, ...args: unknown[]) => {
      logs.push(args);
    },
  });

  const obj = { data: 123 };
  log.debug('message', obj, 'extra');
  expect(logs.length === 1).toBe(true);
  expect(logs[0].length === 4).toBe(true);
  expect(String(logs[0][1]) === 'message').toBe(true);
  const loggedObj = logs[0][2] as Record<string, unknown>;
  expect(loggedObj.data === 123).toBe(true);
  expect(logs[0][3] === 'extra').toBe(true);
});

test('Log - timestamp format: seconds only (SS.mmm)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  log.debug('test');
  expect(String(logs[0][0]).includes('[00.000]')).toBe(true);

  await clock.advanceTime(7138);
  logs.length = 0;
  log.debug('test');
  expect(String(logs[0][0]).includes('[07.138]')).toBe(true);
});

test('Log - timestamp format: minutes (MM:SS.mmm)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 5 minutes 7 seconds 138 milliseconds = 307138ms
  await clock.advanceTime(307138);
  log.debug('test');
  expect(String(logs[0][0]).includes('[05:07.138]')).toBe(true);
});

test('Log - timestamp format: hours (HH:MM:SS.mmm)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 1 hour 5 minutes 7 seconds 138 milliseconds = 3907138ms
  await clock.advanceTime(3907138);
  log.debug('test');
  expect(String(logs[0][0]).includes('[01:05:07.138]')).toBe(true);
});

test('Log - timestamp format: days (Xd HH:MM:SS.mmm)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 3 days 1 hour 2 minutes 3 seconds 456 milliseconds
  // = (3*86400 + 1*3600 + 2*60 + 3)*1000 + 456 = 262923456ms
  await clock.advanceTime(262923456);
  log.debug('test');
  expect(String(logs[0][0]).includes('[3d 01:02:03.456]')).toBe(true);
});

test('Log - timestamp boundary: second to minute', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 59 seconds 999 milliseconds (should still be in seconds format)
  await clock.advanceTime(59999);
  log.debug('test');
  expect(String(logs[0][0]).includes('[59.999]')).toBe(true);

  logs.length = 0;
  // Advance 1 more ms to reach 60000 (1 minute)
  await clock.advanceTime(1);
  log.debug('test');
  expect(String(logs[0][0]).includes('[01:00.000]')).toBe(true);
});

test('Log - timestamp boundary: minute to hour', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 59 minutes 59 seconds 999 milliseconds
  await clock.advanceTime(3599999);
  log.debug('test');
  expect(String(logs[0][0]).includes('[59:59.999]')).toBe(true);

  logs.length = 0;
  // Advance 1 more ms to reach 1 hour
  await clock.advanceTime(1);
  log.debug('test');
  expect(String(logs[0][0]).includes('[01:00:00.000]')).toBe(true);
});

test('Log - timestamp boundary: hour to day', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  // 23 hours 59 minutes 59 seconds 999 milliseconds
  await clock.advanceTime(86399999);
  log.debug('test');
  expect(String(logs[0][0]).includes('[23:59:59.999]')).toBe(true);

  logs.length = 0;
  // Advance 1 more ms to reach 1 day
  await clock.advanceTime(1);
  log.debug('test');
  expect(String(logs[0][0]).includes('[1d 00:00:00.000]')).toBe(true);
});

test('Log - child logger with prefix', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const child = log.child('mymodule');
  child.debug('test');

  expect(logs.length === 1).toBe(true);
  expect(String(logs[0][0]).includes('[00.000]')).toBe(true);
  expect(String(logs[0][1]).includes('[mymodule]')).toBe(true);
  expect(String(logs[0][2]) === 'test').toBe(true);
});

test('Log - nested child loggers (two levels)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const child1 = log.child('module');
  const child2 = child1.child('component');
  child2.debug('test');

  expect(logs.length === 1).toBe(true);
  const prefix = String(logs[0][1]);
  expect(prefix.includes('[module.component]')).toBe(true);
});

test('Log - nested child loggers (three levels)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const child1 = log.child('a');
  const child2 = child1.child('b');
  const child3 = child2.child('c');
  child3.debug('test');

  expect(logs.length === 1).toBe(true);
  const prefix = String(logs[0][1]);
  expect(prefix.includes('[a.b.c]')).toBe(true);
});

test('Log - child creates new instances', async () => {
  const log = new Log();
  const child1 = log.child('name');
  const child2 = log.child('name');

  expect(child1 !== child2).toBe(true);
});

test('Log - rawLog receives correct level and arguments', async () => {
  const levels: LogLevel[] = [];
  const argsCollected: Array<unknown[]> = [];

  const log = new Log({
    clock: new VirtualClock(),
    rawLog: (level: LogLevel, ...args: unknown[]) => {
      levels.push(level);
      argsCollected.push([...args]);
    },
  });

  log.debug('debug-msg');
  log.info('info-msg');
  log.warn('warn-msg');
  log.error('error-msg');

  expect(levels.length === 4).toBe(true);
  expect(levels[0] === 'debug').toBe(true);
  expect(levels[1] === 'info').toBe(true);
  expect(levels[2] === 'warn').toBe(true);
  expect(levels[3] === 'error').toBe(true);

  expect(argsCollected[0].length === 2).toBe(true);
  expect(argsCollected[1].length === 2).toBe(true);
  expect(argsCollected[2].length === 2).toBe(true);
  expect(argsCollected[3].length === 2).toBe(true);
});

test('Log - child inherits parent clock', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const child = log.child('module');

  await clock.advanceTime(65000);
  child.debug('test');

  const timestamp = String(logs[0][0]);
  expect(timestamp.includes('[01:05.000]')).toBe(true);
});

test('Log - root logger timestamp resets at creation', async () => {
  const clock = new VirtualClock({ startTime: 5000 });
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  log.debug('test');

  const timestamp = String(logs[0][0]);
  expect(timestamp.includes('[00.000]')).toBe(true);
});

test('Log - child logger inherits root creation time', async () => {
  const clock = new VirtualClock({ startTime: 1000 });
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const child = log.child('module');

  // Advance to absolute time 66000 (65000ms after root creation)
  await clock.advanceTime(65000);
  child.debug('test');

  const timestamp = String(logs[0][0]);
  expect(timestamp.includes('[01:05.000]')).toBe(true);
});

test('Log - multiple logs with advancing time', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  log.debug('first');
  await clock.advanceTime(1000);
  log.debug('second');
  await clock.advanceTime(2000);
  log.debug('third');

  expect(logs.length === 3).toBe(true);
  expect(String(logs[0][0]).includes('[00.000]')).toBe(true);
  expect(String(logs[1][0]).includes('[01.000]')).toBe(true);
  expect(String(logs[2][0]).includes('[03.000]')).toBe(true);
});

test('Log - default rawLog uses console methods', async () => {
  const originalDebug = console.debug;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const calls: Array<{ method: string; args: unknown[] }> = [];

  console.debug = (...args: unknown[]) => {
    calls.push({ method: 'debug', args });
  };
  console.info = (...args: unknown[]) => {
    calls.push({ method: 'info', args });
  };
  console.warn = (...args: unknown[]) => {
    calls.push({ method: 'warn', args });
  };
  console.error = (...args: unknown[]) => {
    calls.push({ method: 'error', args });
  };

  try {
    const log = new Log({ clock: new VirtualClock() });

    log.debug('test');
    log.info('test');
    log.warn('test');
    log.error('test');

    expect(calls.length === 4).toBe(true);
    expect(calls[0].method === 'debug').toBe(true);
    expect(calls[1].method === 'info').toBe(true);
    expect(calls[2].method === 'warn').toBe(true);
    expect(calls[3].method === 'error').toBe(true);
  } finally {
    console.debug = originalDebug;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
});

test('Log - complex nesting with different branches', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  const a = log.child('a');
  const b = log.child('b');
  const a1 = a.child('1');
  const a2 = a.child('2');
  const b1 = b.child('1');

  a.debug('a');
  a1.debug('a.1');
  a2.debug('a.2');
  b.debug('b');
  b1.debug('b.1');

  expect(logs.length === 5).toBe(true);
  expect(String(logs[0][1]).includes('[a]')).toBe(true);
  expect(String(logs[1][1]).includes('[a.1]')).toBe(true);
  expect(String(logs[2][1]).includes('[a.2]')).toBe(true);
  expect(String(logs[3][1]).includes('[b]')).toBe(true);
  expect(String(logs[4][1]).includes('[b.1]')).toBe(true);
});
