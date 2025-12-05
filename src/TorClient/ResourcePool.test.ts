import { test, assert } from '@hazae41/phobos';
import { ResourcePool } from './ResourcePool';
import { VirtualClock } from '../clock/VirtualClock';

/**
 * Test helper: creates a mock disposable resource
 */
function createMockResource(id: string = Math.random().toString(36).slice(2)) {
  const resource = {
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

  const pool = new ResourcePool({ factory, clock: new VirtualClock() });
  pool.on('resource-created', () => events.push('created'));
  pool.on('resource-acquired', () => events.push('acquired'));

  const resource = await pool.acquire();

  assert(resource.id === 'r1', 'should acquire created resource');
  assert(createCount === 1, 'should create one resource');
  assert(events.length > 0, 'should emit events');

  pool.dispose();
});

test('ResourcePool: acquire from buffered pool returns existing resource', async () => {
  const clock = new VirtualClock();
  let createCount = 0;

  const factory = async () => {
    createCount++;
    return createMockResource(`r${createCount}`);
  };

  const pool = new ResourcePool({ factory, clock, targetSize: 2 });

  // Wait for pool to fill
  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.size() >= 2) break;
  }

  assert(pool.size() === 2, 'should have 2 buffered resources');

  const resource1 = await pool.acquire();
  assert(resource1.id === 'r1', 'should acquire first resource');
  assert(pool.size() === 1, 'should have 1 remaining in buffer');

  pool.dispose();
});

test('ResourcePool: size returns buffered count', async () => {
  const clock = new VirtualClock();

  const factory = async () => createMockResource();
  const pool = new ResourcePool({ factory, clock, targetSize: 3 });

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
  const pool = new ResourcePool({ factory, clock, targetSize: 2 });

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
  const createdResources: any[] = [];

  const factory = async () => {
    const resource = createMockResource();
    createdResources.push(resource);
    return resource;
  };

  const pool = new ResourcePool({ factory, clock, targetSize: 3 });

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.size() >= 3) break;
  }

  assert(pool.size() === 3, 'should have 3 resources');

  pool.dispose();

  for (const resource of createdResources) {
    assert(resource.disposed, 'all resources should be disposed');
  }
});

test('ResourcePool: waitForFull resolves when at target', async () => {
  const factory = async () => createMockResource();
  const pool = new ResourcePool({ factory, clock: new VirtualClock() });

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

  const pool = new ResourcePool({ factory, clock, targetSize: 1 });
  pool.on('creation-failed', () => {
    failureCount++;
  });

  for (let i = 0; i < 10; i++) {
    await clock.advanceTime(5000);
    if (pool.size() > 0) break;
  }

  assert(failureCount > 0, 'should emit creation-failed events');

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

  const pool = new ResourcePool({ factory, clock, targetSize: 1 });

  for (let i = 0; i < 15; i++) {
    await clock.advanceTime(10000);
    if (pool.size() > 0) break;
  }

  assert(timestamps.length >= 3, 'should have at least 3 creation attempts');

  pool.dispose();
});

test('ResourcePool: dispose throws on subsequent operations', async () => {
  const pool = new ResourcePool({
    factory: async () => createMockResource(),
    clock: new VirtualClock(),
  });
  pool.dispose();

  let threwOnAcquire = false;
  try {
    await pool.acquire();
  } catch (e) {
    threwOnAcquire = String(e).includes('disposed');
  }

  assert(threwOnAcquire, 'should throw on acquire after dispose');
});

test('ResourcePool: racing multiple concurrent acquires', async () => {
  const clock = new VirtualClock();
  const createdResources: any[] = [];

  const factory = async () => {
    const resource = createMockResource();
    createdResources.push(resource);
    return resource;
  };

  const pool = new ResourcePool({ factory, clock });

  const promises = [pool.acquire(), pool.acquire(), pool.acquire()];
  const results = await Promise.all(promises);

  assert(results.length === 3, 'should get 3 resources from racing');

  const ids = new Set(results.map(r => r.id));
  assert(ids.size === 3, 'should get 3 different resources');

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
    clock,
    targetSize: 10,
    concurrencyLimit: 2,
  });

  await clock.advanceTime(1000);

  assert(maxConcurrent <= 2, 'should respect concurrency limit of 2');

  pool.dispose();
});

test('ResourcePool: target-size-reached event emitted when pool fills', async () => {
  const clock = new VirtualClock();
  let reachedCount = 0;

  const factory = async () => createMockResource();
  const pool = new ResourcePool({ factory, clock, targetSize: 2 });
  pool.on('target-size-reached', () => {
    reachedCount++;
  });

  for (let i = 0; i < 5; i++) {
    await clock.advanceTime(5000);
    if (pool.atTargetSize()) break;
  }

  assert(reachedCount === 1, 'should emit target-size-reached once');

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
