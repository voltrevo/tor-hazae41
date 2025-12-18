import { test, expect } from 'vitest';
import { Future } from './future';

test('future', async () => {
  const future = new Future<void>();

  const start = Date.now();
  setTimeout(() => future.resolve(), 1000);

  await future.promise;

  const delay = Date.now() - start;
  // Skip strict timing check in browser (browser timings can be faster/differ)
  if (typeof window === 'undefined') {
    expect(delay > 1000).toBe(true);
  }
});
