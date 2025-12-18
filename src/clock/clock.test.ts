import { test, expect } from 'vitest';
import { SystemClock } from './SystemClock';
import { VirtualClock } from './VirtualClock';

test('SystemClock - basic functionality', async () => {
  const clock = new SystemClock();

  const now = clock.now();
  expect(typeof now === 'number').toBe(true);
  expect(now > 0).toBe(true);
});

test('SystemClock - setTimeout', async () => {
  const clock = new SystemClock();
  let executed = false;

  const promise = new Promise<void>(resolve => {
    clock.setTimeout(() => {
      executed = true;
      resolve();
    }, 10);
  });

  await promise;
  expect(executed).toBe(true);
});

test('SystemClock - clearTimeout', async () => {
  const clock = new SystemClock();
  let executed = false;

  const timerId = clock.setTimeout(() => {
    executed = true;
  }, 10);

  clock.clearTimeout(timerId);

  await new Promise(resolve => setTimeout(resolve, 20));
  expect(!executed).toBe(true);
});

test('SystemClock - setInterval', async () => {
  const clock = new SystemClock();
  let count = 0;

  const promise = new Promise<void>(resolve => {
    const intervalId = clock.setInterval(() => {
      count++;
      if (count >= 3) {
        clock.clearInterval(intervalId);
        resolve();
      }
    }, 10);
  });

  await promise;
  expect(count === 3).toBe(true);
});

test('SystemClock - delay', async () => {
  const clock = new SystemClock();
  let executed = false;

  clock.delay(10).then(() => {
    executed = true;
  });

  await new Promise(resolve => setTimeout(resolve, 20));
  expect(executed).toBe(true);
});

test('VirtualClock - manual mode - start at timestamp 0', async () => {
  const clock = new VirtualClock();
  expect(clock.now() === 0).toBe(true);
});

test('VirtualClock - manual mode - advance time', async () => {
  const clock = new VirtualClock();

  await clock.advanceTime(100);
  expect(clock.now() === 100).toBe(true);

  await clock.advanceTime(50);
  expect(clock.now() === 150).toBe(true);
});

test('VirtualClock - manual mode - timer execution', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.setTimeout(() => {
    executed = true;
  }, 100);

  await clock.advanceTime(50);
  expect(!executed).toBe(true);

  await clock.advanceTime(50);
  expect(executed).toBe(true);
});

test('VirtualClock - manual mode - multiple timers order', async () => {
  const clock = new VirtualClock();
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 30);
  clock.setTimeout(() => order.push(3), 70);

  await clock.advanceTime(100);
  expect(order.length === 3).toBe(true);
  expect(order[0] === 2).toBe(true);
  expect(order[1] === 1).toBe(true);
  expect(order[2] === 3).toBe(true);
});

test('VirtualClock - manual mode - setInterval', async () => {
  const clock = new VirtualClock();
  let count = 0;

  clock.setInterval(() => {
    count++;
  }, 50);

  await clock.advanceTime(50);
  expect(count === 1).toBe(true);

  await clock.advanceTime(50);
  expect(count === (2 as number)).toBe(true);

  await clock.advanceTime(100);
  expect(count === (4 as number)).toBe(true);
});

test('VirtualClock - manual mode - clearTimeout', async () => {
  const clock = new VirtualClock();
  let executed = false;

  const timerId = clock.setTimeout(() => {
    executed = true;
  }, 100);

  clock.clearTimeout(timerId);
  await clock.advanceTime(100);
  expect(!executed).toBe(true);
});

test('VirtualClock - manual mode - clearInterval', async () => {
  const clock = new VirtualClock();
  let count = 0;

  const intervalId = clock.setInterval(() => {
    count++;
  }, 50);

  await clock.advanceTime(50);
  expect(count === 1).toBe(true);

  clock.clearInterval(intervalId);
  await clock.advanceTime(100);
  expect(count === 1).toBe(true);
});

test('VirtualClock - manual mode - delay', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.delay(100).then(() => {
    executed = true;
  });

  await clock.advanceTime(50);
  expect(!executed).toBe(true);

  await clock.advanceTime(50);
  expect(executed).toBe(true);
});

test('VirtualClock - manual mode - delay with macrotask behavior', async () => {
  const clock = new VirtualClock();
  const order: number[] = [];

  clock.delay(50).then(() => {
    order.push(2);
  });

  order.push(1);

  await clock.advanceTime(50);
  // Due to macrotask behavior, order.push(1) should execute before delay resolves
  expect(order.length === 2).toBe(true);
  expect(order[0] === 1).toBe(true);
  expect(order[1] === 2).toBe(true);
});

test('VirtualClock - automated mode - basic event loop', async () => {
  const clock = new VirtualClock({ automated: true });
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 30);
  clock.setTimeout(() => order.push(3), 70);

  await clock.run();
  expect(order.length === 3).toBe(true);
  expect(order[0] === 2).toBe(true);
  expect(order[1] === 1).toBe(true);
  expect(order[2] === 3).toBe(true);
});

test('VirtualClock - automated mode - tasks scheduling more tasks', async () => {
  const clock = new VirtualClock({ automated: true });
  const order: number[] = [];

  clock.setTimeout(() => {
    order.push(1);
    clock.setTimeout(() => {
      order.push(2);
    }, 20);
  }, 30);

  clock.setTimeout(() => {
    order.push(3);
  }, 40);

  await clock.run();
  expect(order.length === 3).toBe(true);
  expect(order[0] === 1).toBe(true);
  expect(order[1] === 3).toBe(true);
  expect(order[2] === 2).toBe(true);
});

test('VirtualClock - automated mode - setInterval', async () => {
  const clock = new VirtualClock({ automated: true });
  let count = 0;

  clock.setInterval(() => {
    count++;
    if (count >= 3) {
      clock.stop();
    }
  }, 50);

  await clock.run();
  expect(count === 3).toBe(true);
});

test('VirtualClock - automated mode - stop execution', async () => {
  const clock = new VirtualClock({ automated: true });
  let count = 0;

  clock.setTimeout(() => {
    count++;
  }, 50);

  clock.setTimeout(() => {
    count++;
    clock.stop();
  }, 100);

  clock.setTimeout(() => {
    count++;
  }, 150);

  await clock.run();
  expect(count === 2).toBe(true);
});

test('VirtualClock - automated mode - delay', async () => {
  const clock = new VirtualClock({ automated: true });
  const order: number[] = [];

  clock.delay(50).then(() => {
    order.push(2);
  });

  clock.setTimeout(() => {
    order.push(1);
  }, 30);

  await clock.run();
  expect(order.length === 2).toBe(true);
  expect(order[0] === 1).toBe(true);
  expect(order[1] === 2).toBe(true);
});

test('VirtualClock - unref/ref basic functionality', async () => {
  const clock = new VirtualClock();
  let executed = false;

  const _timerId = clock.setTimeout(() => {
    executed = true;
  }, 1000);

  // Timer should be refed by default
  await clock.advanceTime(1000);
  expect(executed).toBe(true);

  // Reset for next test
  executed = false;
  const _timerId2 = clock.setTimeout(() => {
    executed = true;
  }, 2000);

  clock.unref(_timerId2);
  await clock.advanceTime(2000);
  expect(executed).toBe(true);
});

test('VirtualClock - automated mode - unref behavior', async () => {
  const clock = new VirtualClock({ automated: true });
  let refedExecuted = false;
  let unrefedExecuted = false;

  const _refedTimerId = clock.setTimeout(() => {
    refedExecuted = true;
  }, 1000);

  const unrefedTimerId = clock.setTimeout(() => {
    unrefedExecuted = true;
  }, 2000);

  clock.unref(unrefedTimerId);

  await clock.run();
  expect(refedExecuted).toBe(true);
  expect(!unrefedExecuted).toBe(true);
  expect(clock.now() === 1000).toBe(true);
});

test('VirtualClock - automated mode - ref after unref', async () => {
  const clock = new VirtualClock({ automated: true });
  let executed = false;

  const _timerId = clock.setTimeout(() => {
    executed = true;
  }, 3000);

  clock.unref(_timerId);
  clock.ref(_timerId);

  await clock.run();
  expect(executed).toBe(true);
  expect(clock.now() === 3000).toBe(true);
});

test('SystemClock - unref/ref cross-platform', async () => {
  const clock = new SystemClock();
  let executed = false;

  const timerId = clock.setTimeout(() => {
    executed = true;
  }, 100);

  // Should not throw in browser environment
  clock.unref(timerId);
  clock.ref(timerId);

  await new Promise(resolve => setTimeout(resolve, 150));
  expect(executed).toBe(true);
});

test('SystemClock - delayUnref', async () => {
  const clock = new SystemClock();
  let executed = false;

  clock.delayUnref(100).then(() => {
    executed = true;
  });

  await new Promise(resolve => setTimeout(resolve, 150));
  expect(executed).toBe(true);
});

test('VirtualClock - delayUnref basic functionality', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.delayUnref(2000).then(() => {
    executed = true;
  });

  await clock.advanceTime(2000);
  expect(executed).toBe(true);
});

test('VirtualClock - automated mode - delayUnref behavior', async () => {
  const clock = new VirtualClock({ automated: true });
  let refedExecuted = false;
  let unrefedExecuted = false;

  clock.delay(1000).then(() => {
    refedExecuted = true;
  });

  clock.delayUnref(2000).then(() => {
    unrefedExecuted = true;
  });

  await clock.run();
  expect(refedExecuted).toBe(true);
  expect(!unrefedExecuted).toBe(true);
  expect(clock.now() === 1000).toBe(true);
});

test('VirtualClock - manual mode - timer callback with logging', async () => {
  let callbackExecuted = false;
  const clock = new VirtualClock();

  clock.setTimeout(() => {
    callbackExecuted = true;
  }, 50);

  await clock.advanceTime(50);
  expect(callbackExecuted).toBe(true);
});

test('VirtualClock - automated mode - timer callback execution', async () => {
  const clock = new VirtualClock({ automated: true });
  let callbackExecuted = false;

  clock.setTimeout(() => {
    callbackExecuted = true;
  }, 50);

  await clock.run();
  expect(callbackExecuted).toBe(true);
});

test('VirtualClock - unref on non-existent timer', async () => {
  const clock = new VirtualClock();
  // Should not throw
  clock.unref(99999);
  expect(true).toBe(true);
});

test('VirtualClock - ref on non-existent timer', async () => {
  const clock = new VirtualClock();
  // Should not throw
  clock.ref(99999);
  expect(true).toBe(true);
});

test('VirtualClock - advanceTime on automated mode should throw', async () => {
  const clock = new VirtualClock({ automated: true });
  let thrown = false;

  try {
    await clock.advanceTime(100);
  } catch (error) {
    thrown =
      error instanceof Error &&
      error.message === 'Cannot manually advance time in automated mode';
  }

  expect(thrown).toBe(true);
});

test('VirtualClock - run on manual mode should throw', async () => {
  const clock = new VirtualClock({ automated: false });
  let thrown = false;

  try {
    await clock.run();
  } catch (error) {
    thrown =
      error instanceof Error &&
      error.message === 'Cannot run manual clock in automated mode';
  }

  expect(thrown).toBe(true);
});

test('VirtualClock - run called twice returns immediately', async () => {
  const clock = new VirtualClock({ automated: true });
  let count = 0;

  clock.setTimeout(() => {
    count++;
  }, 50);

  // First run
  const promise1 = clock.run();
  // Second run should return immediately
  const promise2 = clock.run();

  await Promise.all([promise1, promise2]);
  expect(count === 1).toBe(true);
});

test('VirtualClock - stop when not running', async () => {
  const clock = new VirtualClock({ automated: true });
  // Should not throw
  clock.stop();
  expect(true).toBe(true);
});

test('VirtualClock - multiple timers at same executeTime', async () => {
  const clock = new VirtualClock();
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 50);
  clock.setTimeout(() => order.push(3), 50);

  await clock.advanceTime(50);
  expect(order.length === 3).toBe(true);
});

test('VirtualClock - setInterval execution', async () => {
  const clock = new VirtualClock();
  let callCount = 0;

  clock.setInterval(() => {
    callCount++;
  }, 50);

  await clock.advanceTime(100);
  expect(callCount === 2).toBe(true);
});

test('VirtualClock - timer cleared during execution', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.setTimeout(() => {
    clock.clearTimeout(99999); // Clear non-existent timer
    executed = true;
  }, 50);

  await clock.advanceTime(50);
  expect(executed).toBe(true);
});
