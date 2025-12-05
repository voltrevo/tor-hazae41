import { test, assert } from '@hazae41/phobos';
import { Log, LogLevel } from './index';
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
  assert(logs.length === 1, 'should log once');
  assert(String(logs[0][0]).includes('[00.000]'), 'should include timestamp');
  assert(String(logs[0][1]) === 'test message', 'should include message');
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
  assert(logs.length === 1, 'should log once');
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
  assert(logs.length === 1, 'should log once');
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
  assert(logs.length === 1, 'should log once');
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
  assert(logs.length === 1, 'should log once');
  assert(logs[0].length === 4, 'should have timestamp + 3 args');
  assert(String(logs[0][1]) === 'message', 'first arg should be message');
  const loggedObj = logs[0][2] as Record<string, unknown>;
  assert(loggedObj.data === 123, 'second arg should be object');
  assert(logs[0][3] === 'extra', 'third arg should be extra');
});

test('Log - timestamp format: seconds only (SS.mmm)', async () => {
  const clock = new VirtualClock();
  const logs: unknown[][] = [];
  const log = new Log({
    clock,
    rawLog: (_level: LogLevel, ...args: unknown[]) => logs.push(args),
  });

  log.debug('test');
  assert(
    String(logs[0][0]).includes('[00.000]'),
    'should show 00.000 at start'
  );

  await clock.advanceTime(7138);
  logs.length = 0;
  log.debug('test');
  assert(
    String(logs[0][0]).includes('[07.138]'),
    'should show 07.138 after 7138ms'
  );
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
  assert(
    String(logs[0][0]).includes('[05:07.138]'),
    'should show 05:07.138 for 5m 7s 138ms'
  );
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
  assert(
    String(logs[0][0]).includes('[01:05:07.138]'),
    'should show 01:05:07.138 for 1h 5m 7s 138ms'
  );
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
  assert(
    String(logs[0][0]).includes('[3d 01:02:03.456]'),
    'should show 3d 01:02:03.456'
  );
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
  assert(
    String(logs[0][0]).includes('[59.999]'),
    'should show 59.999 just before minute'
  );

  logs.length = 0;
  // Advance 1 more ms to reach 60000 (1 minute)
  await clock.advanceTime(1);
  log.debug('test');
  assert(
    String(logs[0][0]).includes('[01:00.000]'),
    'should show 01:00.000 at 1 minute'
  );
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
  assert(
    String(logs[0][0]).includes('[59:59.999]'),
    'should show 59:59.999 just before hour'
  );

  logs.length = 0;
  // Advance 1 more ms to reach 1 hour
  await clock.advanceTime(1);
  log.debug('test');
  assert(
    String(logs[0][0]).includes('[01:00:00.000]'),
    'should show 01:00:00.000 at 1 hour'
  );
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
  assert(
    String(logs[0][0]).includes('[23:59:59.999]'),
    'should show 23:59:59.999 just before day'
  );

  logs.length = 0;
  // Advance 1 more ms to reach 1 day
  await clock.advanceTime(1);
  log.debug('test');
  assert(
    String(logs[0][0]).includes('[1d 00:00:00.000]'),
    'should show 1d 00:00:00.000 at 1 day'
  );
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

  assert(logs.length === 1, 'should log once');
  assert(String(logs[0][0]).includes('[00.000]'), 'should include timestamp');
  assert(
    String(logs[0][1]).includes('[mymodule]'),
    'should include child prefix'
  );
  assert(String(logs[0][2]) === 'test', 'should include message');
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

  assert(logs.length === 1, 'should log once');
  const prefix = String(logs[0][1]);
  assert(
    prefix.includes('[module.component]'),
    'should use dot notation for nested children'
  );
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

  assert(logs.length === 1, 'should log once');
  const prefix = String(logs[0][1]);
  assert(
    prefix.includes('[a.b.c]'),
    'should use dot notation for three levels'
  );
});

test('Log - child creates new instances', async () => {
  const log = new Log();
  const child1 = log.child('name');
  const child2 = log.child('name');

  assert(child1 !== child2, 'should create different instances');
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

  assert(levels.length === 4, 'should have logged 4 times');
  assert(levels[0] === 'debug', 'first log should be debug');
  assert(levels[1] === 'info', 'second log should be info');
  assert(levels[2] === 'warn', 'third log should be warn');
  assert(levels[3] === 'error', 'fourth log should be error');

  assert(
    argsCollected[0].length === 2,
    'debug (no prefix) should have timestamp + message'
  );
  assert(
    argsCollected[1].length === 2,
    'info (no prefix) should have timestamp + message'
  );
  assert(
    argsCollected[2].length === 2,
    'warn (no prefix) should have timestamp + message'
  );
  assert(
    argsCollected[3].length === 2,
    'error (no prefix) should have timestamp + message'
  );
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
  assert(
    timestamp.includes('[01:05.000]'),
    'child should use parent clock time'
  );
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
  assert(
    timestamp.includes('[00.000]'),
    'timestamp should be relative to root logger creation'
  );
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
  assert(
    timestamp.includes('[01:05.000]'),
    'child timestamp should be relative to root creation'
  );
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

  assert(logs.length === 3, 'should have 3 logs');
  assert(String(logs[0][0]).includes('[00.000]'), 'first should be at 0ms');
  assert(String(logs[1][0]).includes('[01.000]'), 'second should be at 1s');
  assert(String(logs[2][0]).includes('[03.000]'), 'third should be at 3s');
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

    assert(calls.length === 4, 'should call console methods 4 times');
    assert(calls[0].method === 'debug', 'first call should be debug');
    assert(calls[1].method === 'info', 'second call should be info');
    assert(calls[2].method === 'warn', 'third call should be warn');
    assert(calls[3].method === 'error', 'fourth call should be error');
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

  assert(logs.length === 5, 'should have 5 logs');
  assert(String(logs[0][1]).includes('[a]'), 'first log should have [a]');
  assert(String(logs[1][1]).includes('[a.1]'), 'second log should have [a.1]');
  assert(String(logs[2][1]).includes('[a.2]'), 'third log should have [a.2]');
  assert(String(logs[3][1]).includes('[b]'), 'fourth log should have [b]');
  assert(String(logs[4][1]).includes('[b.1]'), 'fifth log should have [b.1]');
});
