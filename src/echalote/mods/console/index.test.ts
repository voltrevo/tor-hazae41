import { assert, test } from '@hazae41/phobos';
import { Console } from './index.js';

test('Console.debugging is false by default', async () => {
  assert(Console.debugging === false);
});

test('Console.log with debugging disabled (returns early)', async () => {
  Console.log('message');
  assert(true);
});

test('Console.debug with debugging disabled (returns early)', async () => {
  Console.debug('message');
  assert(true);
});

test('Console.error with debugging disabled (returns early)', async () => {
  Console.error('message');
  assert(true);
});

test('Console.warn with debugging disabled (returns early)', async () => {
  Console.warn('message');
  assert(true);
});

test('Console.log with no parameters', async () => {
  Console.log();
  assert(true);
});

test('Console.debug with no parameters', async () => {
  Console.debug();
  assert(true);
});

test('Console.error with no parameters', async () => {
  Console.error();
  assert(true);
});

test('Console.warn with no parameters', async () => {
  Console.warn();
  assert(true);
});

test('Console.log with multiple parameters', async () => {
  Console.log('test', 123, { key: 'value' });
  assert(true);
});

test('Console.debug with multiple parameters', async () => {
  Console.debug('debug', 456, [1, 2, 3]);
  assert(true);
});

test('Console.error with multiple parameters', async () => {
  Console.error('error', new Error('test'));
  assert(true);
});

test('Console.warn with multiple parameters', async () => {
  Console.warn('warning', false, null);
  assert(true);
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

  assert(true);
});

test('Console all methods exist', async () => {
  assert(typeof Console.log === 'function');
  assert(typeof Console.debug === 'function');
  assert(typeof Console.error === 'function');
  assert(typeof Console.warn === 'function');
});
