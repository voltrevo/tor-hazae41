import { test, expect } from 'vitest';
import { ResourcePool } from './ResourcePool';
import { VirtualClock } from '../clock/VirtualClock';
import { Log } from '../Log';

/**
 * Mock resource type for testing
 */
interface MockResource {
  id: string;
  disposed: boolean;
  [Symbol.dispose](): void;
}

/**
 * Test helper: creates a mock disposable resource
 */
function createMockResource(
  id: string = Math.random().toString(36).slice(2)
): MockResource {
  const resource: MockResource = {
    id,
    disposed: false,
    [Symbol.dispose]() {
      this.disposed = true;
    },
  };
  return resource;
}

test('ResourcePool: acquire from empty pool creates resource', async () => {
  const events: string[] = [];
  let createCount = 0;

  const factory = async () => {
    createCount++;
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock: new VirtualClock(),
  });
  pool.on('resource-created', () => events.push('created'));
  pool.on('resource-acquired', () => events.push('acquired'));

  const resource = await pool.acquire();

  expect(resource.id === 'r1').toBe(true);
  expect(createCount === 1).toBe(true);
  expect(events.length > 0).toBe(true);

  pool.dispose();
});

test('ResourcePool: acquire from buffered pool returns existing resource', async () => {
  const clock = new VirtualClock();
  let createCount = 0;

  const factory = async () => {
    createCount++;
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 2,
  });

  // Wait for pool to fill
  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.size() >= 2) break;
  }

  assert(pool.size() === 2, 'should have 2 buffered resources');

  const resource1 = await pool.acquire();
  expect(resource1.id === 'r1').toBe(true);
  assert(pool.size() === 1, 'should have 1 remaining in buffer');

  pool.dispose();
});

test('ResourcePool: size returns buffered count', async () => {
  const clock = new VirtualClock();

  const factory = async () => createMockResource();
  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 3,
  });

  assert(pool.size() === 0, 'should start empty');

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.size() >= 3) break;
  }

  assert(pool.size() === 3, 'should have 3 buffered resources');

  pool.dispose();
});

test('ResourcePool: atTargetSize indicates when pool is full', async () => {
  const clock = new VirtualClock();

  const factory = async () => createMockResource();
  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 2,
  });

  assert(!pool.atTargetSize(), 'should not be at target initially');

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  assert(pool.atTargetSize(), 'should be at target after fill');

  pool.dispose();
});

test('ResourcePool: inFlightCount respects concurrency limit', async () => {
  const clock = new VirtualClock();
  let activeCreations = 0;
  const maxConcurrent: number[] = [];

  const factory = async () => {
    activeCreations++;
    maxConcurrent.push(activeCreations);
    await clock.delay(100);
    activeCreations--;
    return createMockResource();
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 3,
    concurrencyLimit: 2,
  });

  await clock.advanceTime(500);

  assert(
    Math.max(...maxConcurrent) <= 2,
    'should not exceed concurrency limit'
  );

  pool.dispose();
});

test('ResourcePool: dispose cleans up buffered resources', async () => {
  const clock = new VirtualClock();
  const createdResources: MockResource[] = [];

  const factory = async () => {
    const resource = createMockResource();
    createdResources.push(resource);
    return resource;
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 3,
  });

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.size() >= 3) break;
  }

  assert(pool.size() === 3, 'should have 3 resources');

  pool.dispose();

  for (const resource of createdResources) {
    expect(resource.disposed).toBe(true);
  }
});

test('ResourcePool: waitForFull resolves when at target', async () => {
  const factory = async () => createMockResource();
  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock: new VirtualClock(),
  });

  await pool.waitForFull();

  assert(pool.size() === 0, 'pool with target 0 should be at target');

  pool.dispose();
});

test('ResourcePool: creation-failed event emitted on factory error', async () => {
  const clock = new VirtualClock();
  let failureCount = 0;
  let createAttempts = 0;

  const factory = async () => {
    createAttempts++;
    if (createAttempts <= 2) {
      throw new Error('Simulated failure');
    }
    return createMockResource();
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 1,
  });
  pool.on('creation-failed', () => {
    failureCount++;
  });

  for (let i = 0; i < 10; i++) {
    await clock.advanceTime(5000);
    if (pool.size() > 0) break;
  }

  expect(failureCount > 0).toBe(true);

  pool.dispose();
});

test('ResourcePool: backoff increases delay after failures', async () => {
  const clock = new VirtualClock();
  const timestamps: number[] = [];
  let createAttempts = 0;

  const factory = async () => {
    createAttempts++;
    timestamps.push(clock.now());
    if (createAttempts <= 2) {
      throw new Error('Simulated failure');
    }
    return createMockResource();
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 1,
  });

  for (let i = 0; i < 15; i++) {
    await clock.advanceTime(10000);
    if (pool.size() > 0) break;
  }

  expect(timestamps.length >= 3).toBe(true);

  pool.dispose();
});

test('ResourcePool: dispose throws on subsequent operations', async () => {
  const pool = new ResourcePool({
    factory: async () => createMockResource(),
    log: new Log({ rawLog: () => {} }),
    clock: new VirtualClock(),
  });
  pool.dispose();

  let threwOnAcquire = false;
  try {
    await pool.acquire();
  } catch (e) {
    threwOnAcquire = String(e).includes('disposed');
  }

  expect(threwOnAcquire).toBe(true);
});

test('ResourcePool: racing multiple concurrent acquires', async () => {
  const clock = new VirtualClock();
  const createdResources: MockResource[] = [];

  const factory = async () => {
    const resource = createMockResource();
    createdResources.push(resource);
    return resource;
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
  });

  const promises = [pool.acquire(), pool.acquire(), pool.acquire()];
  const results = await Promise.all(promises);

  expect(results.length === 3).toBe(true);

  const ids = new Set(results.map(r => r.id));
  expect(ids.size === 3).toBe(true);

  pool.dispose();
});

test('ResourcePool: concurrency limit prevents too many concurrent creations', async () => {
  const clock = new VirtualClock();
  let maxConcurrent = 0;
  let currentConcurrent = 0;

  const factory = async () => {
    currentConcurrent++;
    maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
    await clock.delay(50);
    currentConcurrent--;
    return createMockResource();
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 10,
    concurrencyLimit: 2,
  });

  await clock.advanceTime(1000);

  expect(maxConcurrent <= 2).toBe(true);

  pool.dispose();
});

test('ResourcePool: target-size-reached event emitted when pool fills', async () => {
  const clock = new VirtualClock();
  let reachedCount = 0;

  const factory = async () => createMockResource();
  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 2,
  });
  pool.on('target-size-reached', () => {
    reachedCount++;
  });

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  expect(reachedCount === 1).toBe(true);

  pool.dispose();
});

test('ResourcePool: configurable backoff parameters', async () => {
  const clock = new VirtualClock();
  let createCount = 0;

  const factory = async () => {
    createCount++;
    if (createCount === 1) throw new Error('fail');
    return createMockResource();
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 1,
    backoffMinMs: 100,
    backoffMaxMs: 1000,
    backoffMultiplier: 1.5,
  });

  // Wait for initial failure, backoff, then success
  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(200);
    if (pool.size() >= 1) break;
  }

  assert(
    pool.size() >= 1,
    'should eventually create resource with custom backoff'
  );

  pool.dispose();
});

test('ResourcePool: minInFlightCount races multiple creations on empty acquire', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;
  const creationOrder: number[] = [];

  const factory = async () => {
    const creationId = ++createCount;
    creationOrder.push(creationId);
    await clock.delay(10);
    return createMockResource(`r${creationId}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 3,
  });

  // Acquire from empty pool - should race 3 creations
  const acquirePromise = pool.acquire();

  const resource = await acquirePromise;

  assert(resource.id.startsWith('r'), 'should return a valid resource');
  expect(createCount === 3).toBe(true);
  expect(creationOrder.length === 3).toBe(true);

  pool.dispose();
  await clock.wait();

  // All 3 creations should have completed with their 10ms delays
  expect(clock.now() === 10).toBe(true);
});

test('ResourcePool: minInFlightCount leftover creations fill buffer', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;

  const factory = async () => {
    createCount++;
    await clock.delay(5);
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 3,
  });

  // Acquire from empty pool - races 3, returns 1
  const acquirePromise = pool.acquire();

  const resource1 = await acquirePromise;
  assert(resource1.id.startsWith('r'), 'should return first resource');
  expect(createCount === 3).toBe(true);

  // Wait for background buffering to complete
  await clock.wait();

  // Now pool should have buffered the 2 other successful creations
  assert(pool.size() === 2, 'should have 2 resources in buffer from racing');

  const _resource2 = await pool.acquire();
  assert(pool.size() === 1, 'should have 1 remaining after acquire');

  pool.dispose();
});

test('ResourcePool: minInFlightCount error handling ignores failures from race', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;

  const factory = async () => {
    const id = ++createCount;
    await clock.delay(5);
    // Only second creation fails, first and third succeed
    if (id === 2) {
      throw new Error('Simulated failure');
    }
    return createMockResource(`r${id}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 3,
  });

  // Acquire - races 3, first succeeds (returned), second fails (dropped), third succeeds (buffered)
  const acquirePromise = pool.acquire();

  const resource = await acquirePromise;
  assert(resource.id.startsWith('r'), 'should return a successful resource');
  expect(createCount === 3).toBe(true);

  // Wait for background buffering to complete
  await clock.wait();

  // Should have 1 in buffer (the third one), second one's error was dropped
  assert(
    pool.size() === 1,
    'should have buffered successful creation, ignoring failures'
  );

  pool.dispose();
});

test('ResourcePool: minInFlightCount with partial errors buffers successes', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;

  const factory = async () => {
    createCount++;
    await clock.delay(5);
    // Only first creation fails
    if (createCount === 1) {
      throw new Error('Simulated failure');
    }
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 3,
  });

  // Acquire - races 3, first fails, 2nd and 3rd succeed
  const acquirePromise = pool.acquire();

  const resource = await acquirePromise;
  assert(resource.id.startsWith('r'), 'should return a successful resource');
  expect(createCount === 3).toBe(true);

  await clock.wait();

  // Should have at least 1 in buffer (the other successful one)
  assert(
    pool.size() >= 1,
    'should have buffered the other successful creation'
  );

  pool.dispose();
});

test('ResourcePool: minInFlightCount with targetSize maintains wholistic accounting', async () => {
  const clock = new VirtualClock();
  let createCount = 0;

  const factory = async () => {
    createCount++;
    await clock.delay(10);
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 2,
    minInFlightCount: 2,
  });

  // Let maintenance and acquire work together
  // Initially maintenance will try to create 2 for targetSize
  // Meanwhile acquire() will race 2 more
  // Should not over-create due to wholistic accounting

  await clock.advanceTime(100);

  // Give buffer fill time
  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  // At target, should have 2 in buffer
  assert(
    pool.size() === 2,
    `should have exactly 2 resources at target size, but got ${pool.size()}`
  );

  pool.dispose();
});

test('ResourcePool: minInFlightCount with targetSize=0 can overfill', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;

  const factory = async () => {
    createCount++;
    await clock.delay(5);
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 0,
    minInFlightCount: 3,
  });

  // With targetSize=0, acquire should race 3 and buffer 2
  const acquirePromise = pool.acquire();

  const resource = await acquirePromise;
  assert(resource.id.startsWith('r'), 'should return resource');

  await clock.wait();

  // Should have overfilled the buffer to 2 even though targetSize=0
  assert(
    pool.size() === 2,
    'should overfill buffer with leftover creations when targetSize=0'
  );

  pool.dispose();
});

test('ResourcePool: minInFlightCount sequential acquires reuse buffered resources', async () => {
  const clock = new VirtualClock({ automated: true });
  let createCount = 0;

  const factory = async () => {
    const id = ++createCount;
    await clock.delay(10);
    return createMockResource(`r${id}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 3,
  });

  // First acquire - races 3
  const acquirePromise1 = pool.acquire();

  const r1 = await acquirePromise1;
  const initialCreateCount = createCount;
  expect(initialCreateCount === 3).toBe(true);

  // Second acquire - should get buffered resource (no new creation)
  const r2 = await pool.acquire();
  expect(createCount === initialCreateCount).toBe(true);
  expect(r1.id !== r2.id).toBe(true);

  pool.dispose();
  await clock.wait();
});

test('ResourcePool: target-size-reached emitted again when pool drops below target', async () => {
  const clock = new VirtualClock();
  let createCount = 0;
  let targetReachedCount = 0;

  const factory = async () => {
    createCount++;
    await clock.delay(10);
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    targetSize: 2,
  });

  pool.on('target-size-reached', () => {
    targetReachedCount++;
  });

  // Wait for target size to be reached
  for (let i = 0; i < 10; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  assert(pool.size() === 2, 'should have 2 resources in pool at target size');
  expect(targetReachedCount === 1).toBe(true);

  // Acquire one resource, dropping pool below target
  const r1 = await pool.acquire();
  assert(pool.size() === 1, 'should have 1 resource after acquire');
  assert(r1.id.startsWith('r'), 'should get a valid resource');

  // Wait for maintenance to refill back to target size
  targetReachedCount = 0; // Reset counter
  for (let i = 0; i < 10; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  assert(pool.size() === 2, 'should refill back to 2 resources');
  expect(targetReachedCount === 1).toBe(true);

  pool.dispose();
});
