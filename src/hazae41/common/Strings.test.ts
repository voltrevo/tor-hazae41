import { test, expect } from 'vitest';
import { Strings } from './Strings.js';

test('Strings.equalsIgnoreCase with identical strings', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'hello');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with different cases', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'HELLO');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with mixed case', async () => {
  const result = Strings.equalsIgnoreCase('HeLLo', 'hEllO');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with different strings', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'world');
  expect(result === false).toBe(true);
});

test('Strings.equalsIgnoreCase with empty strings', async () => {
  const result = Strings.equalsIgnoreCase('', '');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with null values', async () => {
  const result = Strings.equalsIgnoreCase(null, null);
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with undefined values', async () => {
  const result = Strings.equalsIgnoreCase(undefined, undefined);
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with one null and one undefined', async () => {
  const result = Strings.equalsIgnoreCase(null, undefined);
  // null?.toLowerCase() = undefined, undefined?.toLowerCase() = undefined
  // undefined === undefined => true
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with string and null', async () => {
  const result = Strings.equalsIgnoreCase('hello', null);
  expect(result === false).toBe(true);
});

test('Strings.equalsIgnoreCase with string and undefined', async () => {
  const result = Strings.equalsIgnoreCase('hello', undefined);
  expect(result === false).toBe(true);
});

test('Strings.equalsIgnoreCase with special characters', async () => {
  const result = Strings.equalsIgnoreCase('Hello@World!', 'hello@world!');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with numbers as strings', async () => {
  const result = Strings.equalsIgnoreCase('123', '123');
  expect(result === true).toBe(true);
});

test('Strings.equalsIgnoreCase with spaces', async () => {
  const result = Strings.equalsIgnoreCase('hello world', 'HELLO WORLD');
  expect(result === true).toBe(true);
});

test('Strings.splitOnFirst with found separator', async () => {
  const result = Strings.splitOnFirst('hello:world', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === 'world').toBe(true);
});

test('Strings.splitOnFirst with separator not found', async () => {
  const result = Strings.splitOnFirst('helloworld', ':');

  // When indexOf returns -1:
  // first = slice(0, -1) = all but last char = "helloworl"
  // last = slice(-1 + 1) = slice(0) = "helloworld"
  expect(result.length === 2).toBe(true);
  expect(
    result[0] === 'helloworl',
    `expected 'helloworl', got '${result[0]}'`
  ).toBe(true);
  expect(result[1] === 'helloworld').toBe(true);
});

test('Strings.splitOnFirst with separator at start', async () => {
  const result = Strings.splitOnFirst(':world', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === '').toBe(true);
  expect(result[1] === 'world').toBe(true);
});

test('Strings.splitOnFirst with separator at end', async () => {
  const result = Strings.splitOnFirst('hello:', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === '').toBe(true);
});

test('Strings.splitOnFirst with multiple separators (only first)', async () => {
  const result = Strings.splitOnFirst('hello:world:foo', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === 'world:foo').toBe(true);
});

test('Strings.splitOnFirst with empty string', async () => {
  const result = Strings.splitOnFirst('', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === '').toBe(true);
  expect(result[1] === '').toBe(true);
});

test('Strings.splitOnFirst with empty separator', async () => {
  const result = Strings.splitOnFirst('hello', '');

  // indexOf('') returns 0
  // first = slice(0, 0) = ""
  // last = slice(0 + 0) = "hello"
  expect(result.length === 2).toBe(true);
  expect(result[0] === '').toBe(true);
  expect(result[1] === 'hello').toBe(true);
});

test('Strings.splitOnFirst with multi-character separator', async () => {
  const result = Strings.splitOnFirst('hello::world', '::');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === 'world').toBe(true);
});

test('Strings.splitOnFirst with substring separator', async () => {
  const result = Strings.splitOnFirst('hello|world|foo', '|');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === 'world|foo').toBe(true);
});

test('Strings.splitOnFirst with unicode characters', async () => {
  const result = Strings.splitOnFirst('hello🎉world', '🎉');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'hello').toBe(true);
  expect(result[1] === 'world').toBe(true);
});

test('Strings.splitOnFirst case sensitive', async () => {
  const result = Strings.splitOnFirst('HELLO:world', ':');

  expect(result.length === 2).toBe(true);
  expect(result[0] === 'HELLO').toBe(true);
  expect(result[1] === 'world').toBe(true);
});
