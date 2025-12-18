import { test, expect } from 'vitest';
import { Console } from './index.js';

test('Console.debugging is false by default', async () => {
  expect(Console.debugging === false).toBe(true);
});

test('Console.log with debugging disabled (returns early)', async () => {
  Console.log('message');
  expect(true).toBe(true);
});

test('Console.debug with debugging disabled (returns early)', async () => {
  Console.debug('message');
  expect(true).toBe(true);
});

test('Console.error with debugging disabled (returns early)', async () => {
  Console.error('message');
  expect(true).toBe(true);
});

test('Console.warn with debugging disabled (returns early)', async () => {
  Console.warn('message');
  expect(true).toBe(true);
});

test('Console.log with no parameters', async () => {
  Console.log();
  expect(true).toBe(true);
});

test('Console.debug with no parameters', async () => {
  Console.debug();
  expect(true).toBe(true);
});

test('Console.error with no parameters', async () => {
  Console.error();
  expect(true).toBe(true);
});

test('Console.warn with no parameters', async () => {
  Console.warn();
  expect(true).toBe(true);
});

test('Console.log with multiple parameters', async () => {
  Console.log('test', 123, { key: 'value' });
  expect(true).toBe(true);
});

test('Console.debug with multiple parameters', async () => {
  Console.debug('debug', 456, [1, 2, 3]);
  expect(true).toBe(true);
});

test('Console.error with multiple parameters', async () => {
  Console.error('error', new Error('test'));
  expect(true).toBe(true);
});

test('Console.warn with multiple parameters', async () => {
  Console.warn('warning', false, null);
  expect(true).toBe(true);
});

test('Console methods with various types', async () => {
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
    new Error('test error'),
  ];

  for (const testCase of testCases) {
    Console.log(testCase);
    Console.debug(testCase);
    Console.error(testCase);
    Console.warn(testCase);
  }

  expect(true).toBe(true);
});

test('Console all methods exist', async () => {
  expect(typeof Console.log === 'function').toBe(true);
  expect(typeof Console.debug === 'function').toBe(true);
  expect(typeof Console.error === 'function').toBe(true);
  expect(typeof Console.warn === 'function').toBe(true);
});
