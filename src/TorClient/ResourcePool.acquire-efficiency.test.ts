import { test, assert } from '@hazae41/phobos';
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

test('ResourcePool.acquire-efficiency: races minInFlightCount creations regardless of existing in-flight', async () => {
  const clock = new VirtualClock();
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
  const results = await Promise.all([pool.acquire(), pool.acquire()]);

  assert(results[0].id !== '', 'first acquire succeeded');
  assert(results[1].id !== '', 'second acquire succeeded');

  // With current buggy code:
  // First acquire() races 2 creations: r1, r2
  // Second acquire() ALSO races 2 creations: r3, r4
  // Total: 4 creations
  //
  // With the fix we want:
  // First acquire() races 2 creations: r1, r2
  // Second acquire() should wait for first's in-flight to complete
  // Total: 2 creations

  assert(
    createdIds.length === 4,
    `Expected current buggy behavior (4 creations from 2 concurrent acquires), but got ${createdIds.length}. If this assertion fails, the fix was applied.`
  );

  pool.dispose();
});
