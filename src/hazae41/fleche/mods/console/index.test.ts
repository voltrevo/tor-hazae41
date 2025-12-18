import { test, expect } from 'vitest';
import { Console } from './index.js';

test('Console.debugging is false by default', async () => {
  expect(Console.debugging === false).toBe(true);
});

test('Console.debug with debugging disabled (returns early)', async () => {
  // This is tricky to test since debug returns early
  // We can only verify it doesn't throw
  Console.debug('message');
  expect(true).toBe(true);
});

test('Console.debug with multiple parameters', async () => {
  Console.debug('test', 123, { key: 'value' }, [1, 2, 3]);
  expect(true).toBe(true);
});

test('Console.debug with no parameters', async () => {
  Console.debug();
  expect(true).toBe(true);
});

test('Console.debug with various types', async () => {
  const testCases = [
    'string',
    123,
    true,
    false,
    null,
    undefined,
    { obj: 'value' },
    [1, 2, 3],
    () => {},
    Symbol('test'),
  ];

  for (const testCase of testCases) {
    Console.debug(testCase);
  }

  expect(true).toBe(true);
});
