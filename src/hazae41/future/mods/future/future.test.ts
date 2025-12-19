import { test, expect } from 'vitest';
import { VirtualClock } from '../../../../clock/VirtualClock';
import { Future } from './future';

test('future', async () => {
  const clock = new VirtualClock({ automated: true });
  const future = new Future<void>();

  const start = clock.now();
  clock.setTimeout(() => future.resolve(), 1000);

  await future.promise;

  const delay = clock.now() - start;
  expect(delay).toBe(1000);
});
