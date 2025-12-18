import { test, expect } from 'vitest';
import { Log } from '../Log';
import { ResourcePool } from './ResourcePool';
import { VirtualClock } from '../clock/VirtualClock';

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

test('ResourcePool.acquire-efficiency: concurrent acquires reuse in-flight creations', async () => {
  const clock = new VirtualClock({ automated: true });
  const createdIds: string[] = [];

  const factory = async () => {
    const id = `r${createdIds.length + 1}`;
    createdIds.push(id);
    await clock.delay(100);
    return createMockResource(id);
  };

  const pool = new ResourcePool({
    factory,
    log: new Log({ rawLog: () => {} }),
    clock,
    minInFlightCount: 2,
  });

  // Call acquire twice rapidly
  const acquirePromise1 = pool.acquire();
  const acquirePromise2 = pool.acquire();

  const results = await Promise.all([acquirePromise1, acquirePromise2]);

  expect(results[0].id !== '').toBe(true);
  expect(results[1].id !== '').toBe(true);

  // With efficient concurrent acquire handling:
  // First acquire() races 2 creations: r1, r2
  // Second acquire() reuses the same 2 in-flight creations (doesn't create new ones)
  // Total: 2 creations (not 4)
  //
  // Both acquires get different resources from the racing:
  // First acquire() gets the first one to complete
  // Second acquire() gets the second one to complete

  expect(
    createdIds.length === 2,
    `Expected efficient behavior (2 creations from 2 concurrent acquires), but got ${createdIds.length}`
  ).toBe(true);

  // Verify we got different resources
  expect(results[0].id !== results[1].id).toBe(true);

  pool.dispose();
  await clock.wait();

  // Both creations completed with 100ms delays
  expect(clock.now() === 100).toBe(true);
});
