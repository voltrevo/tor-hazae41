import { test, expect } from 'vitest';

test('symbol-dispose-polyfill', () => {
  expect(typeof Symbol.dispose).toBe('symbol');
});
