import { test, assert } from '@hazae41/phobos';
import { SystemClock } from './SystemClock';
import { VirtualClock } from './VirtualClock';

test('SystemClock - basic functionality', async () => {
  const clock = new SystemClock();

  const now = clock.now();
  assert(typeof now === 'number', 'should return number');
  assert(now > 0, 'should return positive timestamp');
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
  assert(executed, 'should execute setTimeout callback');
});

test('SystemClock - clearTimeout', async () => {
  const clock = new SystemClock();
  let executed = false;

  const timerId = clock.setTimeout(() => {
    executed = true;
  }, 10);

  clock.clearTimeout(timerId);

  await new Promise(resolve => setTimeout(resolve, 20));
  assert(!executed, 'should not execute cleared timeout');
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
  assert(count === 3, 'should execute interval 3 times');
});

test('SystemClock - delay', async () => {
  const clock = new SystemClock();
  let executed = false;

  clock.delay(10).then(() => {
    executed = true;
  });

  await new Promise(resolve => setTimeout(resolve, 20));
  assert(executed, 'should resolve delay after specified time');
});

test('VirtualClock - manual mode - start at timestamp 0', async () => {
  const clock = new VirtualClock();
  assert(clock.now() === 0, 'should start at timestamp 0');
});

test('VirtualClock - manual mode - advance time', async () => {
  const clock = new VirtualClock();

  await clock.advanceTime(100);
  assert(clock.now() === 100, 'should advance to 100');

  await clock.advanceTime(50);
  assert(clock.now() === 150, 'should advance to 150');
});

test('VirtualClock - manual mode - timer execution', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.setTimeout(() => {
    executed = true;
  }, 100);

  await clock.advanceTime(50);
  assert(!executed, 'should not execute before time');

  await clock.advanceTime(50);
  assert(executed, 'should execute when time reached');
});

test('VirtualClock - manual mode - multiple timers order', async () => {
  const clock = new VirtualClock();
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 30);
  clock.setTimeout(() => order.push(3), 70);

  await clock.advanceTime(100);
  assert(order.length === 3, 'should execute all timers');
  assert(order[0] === 2, 'should execute timer 2 first');
  assert(order[1] === 1, 'should execute timer 1 second');
  assert(order[2] === 3, 'should execute timer 3 third');
});

test('VirtualClock - manual mode - setInterval', async () => {
  const clock = new VirtualClock();
  let count = 0;

  clock.setInterval(() => {
    count++;
  }, 50);

  await clock.advanceTime(50);
  assert(count === 1, 'should execute once after 50ms');

  await clock.advanceTime(50);
  assert(count === 2, 'should execute twice after 100ms');

  await clock.advanceTime(100);
  assert(count === 4, 'should execute four times after 200ms');
});

test('VirtualClock - manual mode - clearTimeout', async () => {
  const clock = new VirtualClock();
  let executed = false;

  const timerId = clock.setTimeout(() => {
    executed = true;
  }, 100);

  clock.clearTimeout(timerId);
  await clock.advanceTime(100);
  assert(!executed, 'should not execute cleared timeout');
});

test('VirtualClock - manual mode - clearInterval', async () => {
  const clock = new VirtualClock();
  let count = 0;

  const intervalId = clock.setInterval(() => {
    count++;
  }, 50);

  await clock.advanceTime(50);
  assert(count === 1, 'should execute once');

  clock.clearInterval(intervalId);
  await clock.advanceTime(100);
  assert(count === 1, 'should not execute after clear');
});

test('VirtualClock - manual mode - delay', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.delay(100).then(() => {
    executed = true;
  });

  await clock.advanceTime(50);
  assert(!executed, 'should not resolve before time');

  await clock.advanceTime(50);
  assert(executed, 'should resolve when time reached');
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
  assert(order.length === 2, 'should have both entries');
  assert(order[0] === 1, 'should execute synchronous code first');
  assert(order[1] === 2, 'should resolve delay after macrotask');
});

test('VirtualClock - automated mode - basic event loop', async () => {
  const clock = new VirtualClock({ automated: true });
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 30);
  clock.setTimeout(() => order.push(3), 70);

  await clock.run();
  assert(order.length === 3, 'should execute all timers');
  assert(order[0] === 2, 'should execute timer 2 first');
  assert(order[1] === 1, 'should execute timer 1 second');
  assert(order[2] === 3, 'should execute timer 3 third');
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
  assert(order.length === 3, 'should execute all tasks');
  assert(order[0] === 1, 'should execute first task');
  assert(order[1] === 3, 'should execute second task');
  assert(order[2] === 2, 'should execute nested task');
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
  assert(count === 3, 'should execute interval 3 times');
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
  assert(count === 2, 'should stop after second timer');
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
  assert(order.length === 2, 'should execute both');
  assert(order[0] === 1, 'should execute setTimeout first');
  assert(order[1] === 2, 'should execute delay second');
});

test('VirtualClock - unref/ref basic functionality', async () => {
  const clock = new VirtualClock();
  let executed = false;

  const _timerId = clock.setTimeout(() => {
    executed = true;
  }, 1000);

  // Timer should be refed by default
  await clock.advanceTime(1000);
  assert(executed, 'should execute refed timer');

  // Reset for next test
  executed = false;
  const _timerId2 = clock.setTimeout(() => {
    executed = true;
  }, 2000);

  clock.unref(_timerId2);
  await clock.advanceTime(2000);
  assert(executed, 'should execute unref timer in manual mode');
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
  assert(refedExecuted, 'should execute refed timer');
  assert(!unrefedExecuted, 'should not execute unrefed timer');
  assert(clock.now() === 1000, 'time should advance to refed timer only');
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
  assert(executed, 'should execute re-refed timer');
  assert(clock.now() === 3000, 'time should advance to re-refed timer');
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
  assert(executed, 'should execute timer regardless of unref/ref');
});

test('SystemClock - delayUnref', async () => {
  const clock = new SystemClock();
  let executed = false;

  clock.delayUnref(100).then(() => {
    executed = true;
  });

  await new Promise(resolve => setTimeout(resolve, 150));
  assert(executed, 'should execute delayUnref');
});

test('VirtualClock - delayUnref basic functionality', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.delayUnref(2000).then(() => {
    executed = true;
  });

  await clock.advanceTime(2000);
  assert(executed, 'should execute delayUnref in manual mode');
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
  assert(refedExecuted, 'should execute refed delay');
  assert(!unrefedExecuted, 'should not execute unrefed delay');
  assert(clock.now() === 1000, 'time should advance to refed timer only');
});

test('VirtualClock - manual mode - timer callback with logging', async () => {
  let callbackExecuted = false;
  const clock = new VirtualClock();

  clock.setTimeout(() => {
    callbackExecuted = true;
  }, 50);

  await clock.advanceTime(50);
  assert(callbackExecuted, 'callback should execute and be logged');
});

test('VirtualClock - automated mode - timer callback execution', async () => {
  const clock = new VirtualClock({ automated: true });
  let callbackExecuted = false;

  clock.setTimeout(() => {
    callbackExecuted = true;
  }, 50);

  await clock.run();
  assert(callbackExecuted, 'should execute callback in automated mode');
});

test('VirtualClock - unref on non-existent timer', async () => {
  const clock = new VirtualClock();
  // Should not throw
  clock.unref(99999);
  assert(true, 'should not throw on non-existent timer id');
});

test('VirtualClock - ref on non-existent timer', async () => {
  const clock = new VirtualClock();
  // Should not throw
  clock.ref(99999);
  assert(true, 'should not throw on non-existent timer id');
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

  assert(thrown, 'should throw when calling advanceTime on automated clock');
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

  assert(thrown, 'should throw when calling run on manual clock');
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
  assert(count === 1, 'should not execute twice');
});

test('VirtualClock - stop when not running', async () => {
  const clock = new VirtualClock({ automated: true });
  // Should not throw
  clock.stop();
  assert(true, 'should not throw when stop called while not running');
});

test('VirtualClock - multiple timers at same executeTime', async () => {
  const clock = new VirtualClock();
  const order: number[] = [];

  clock.setTimeout(() => order.push(1), 50);
  clock.setTimeout(() => order.push(2), 50);
  clock.setTimeout(() => order.push(3), 50);

  await clock.advanceTime(50);
  assert(order.length === 3, 'should execute all timers at same time');
});

test('VirtualClock - setInterval execution', async () => {
  const clock = new VirtualClock();
  let callCount = 0;

  const intervalId = clock.setInterval(() => {
    callCount++;
  }, 50);

  await clock.advanceTime(100);
  assert(callCount === 2, 'should execute interval twice');
});

test('VirtualClock - timer cleared during execution', async () => {
  const clock = new VirtualClock();
  let executed = false;

  clock.setTimeout(() => {
    clock.clearTimeout(99999); // Clear non-existent timer
    executed = true;
  }, 50);

  await clock.advanceTime(50);
  assert(executed, 'should execute even when clearing non-existent timer');
});
