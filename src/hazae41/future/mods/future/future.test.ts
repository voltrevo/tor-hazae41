import { test, expect } from 'vitest';
import { Future } from './future';

test('future', async () => {
  const future = new Future<void>();

  const start = Date.now();
  setTimeout(() => future.resolve(), 1000);

  await future.promise;

  const delay = Date.now() - start;
  expect(delay > 1000).toBe(true);
});
