import { test } from '../../../hazae41/phobos/mod';
import { assert } from '../../../utils/assert';
import { Strings } from './strings.js';

test('Strings.equalsIgnoreCase with identical strings', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'hello');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with different cases', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'HELLO');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with mixed case', async () => {
  const result = Strings.equalsIgnoreCase('HeLLo', 'hEllO');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with different strings', async () => {
  const result = Strings.equalsIgnoreCase('hello', 'world');
  assert(result === false);
});

test('Strings.equalsIgnoreCase with empty strings', async () => {
  const result = Strings.equalsIgnoreCase('', '');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with null values', async () => {
  const result = Strings.equalsIgnoreCase(null, null);
  assert(result === true);
});

test('Strings.equalsIgnoreCase with undefined values', async () => {
  const result = Strings.equalsIgnoreCase(undefined, undefined);
  assert(result === true);
});

test('Strings.equalsIgnoreCase with one null and one undefined', async () => {
  const result = Strings.equalsIgnoreCase(null, undefined);
  // null?.toLowerCase() = undefined, undefined?.toLowerCase() = undefined
  // undefined === undefined => true
  assert(result === true);
});

test('Strings.equalsIgnoreCase with string and null', async () => {
  const result = Strings.equalsIgnoreCase('hello', null);
  assert(result === false);
});

test('Strings.equalsIgnoreCase with string and undefined', async () => {
  const result = Strings.equalsIgnoreCase('hello', undefined);
  assert(result === false);
});

test('Strings.equalsIgnoreCase with special characters', async () => {
  const result = Strings.equalsIgnoreCase('Hello@World!', 'hello@world!');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with numbers as strings', async () => {
  const result = Strings.equalsIgnoreCase('123', '123');
  assert(result === true);
});

test('Strings.equalsIgnoreCase with spaces', async () => {
  const result = Strings.equalsIgnoreCase('hello world', 'HELLO WORLD');
  assert(result === true);
});

test('Strings.splitOnFirst with found separator', async () => {
  const result = Strings.splitOnFirst('hello:world', ':');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === 'world');
});

test('Strings.splitOnFirst with separator not found', async () => {
  const result = Strings.splitOnFirst('helloworld', ':');

  // When indexOf returns -1:
  // first = slice(0, -1) = all but last char = "helloworl"
  // last = slice(-1 + 1) = slice(0) = "helloworld"
  assert(result.length === 2);
  assert(result[0] === 'helloworl', `expected 'helloworl', got '${result[0]}'`);
  assert(result[1] === 'helloworld');
});

test('Strings.splitOnFirst with separator at start', async () => {
  const result = Strings.splitOnFirst(':world', ':');

  assert(result.length === 2);
  assert(result[0] === '');
  assert(result[1] === 'world');
});

test('Strings.splitOnFirst with separator at end', async () => {
  const result = Strings.splitOnFirst('hello:', ':');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === '');
});

test('Strings.splitOnFirst with multiple separators (only first)', async () => {
  const result = Strings.splitOnFirst('hello:world:foo', ':');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === 'world:foo');
});

test('Strings.splitOnFirst with empty string', async () => {
  const result = Strings.splitOnFirst('', ':');

  assert(result.length === 2);
  assert(result[0] === '');
  assert(result[1] === '');
});

test('Strings.splitOnFirst with empty separator', async () => {
  const result = Strings.splitOnFirst('hello', '');

  // indexOf('') returns 0
  // first = slice(0, 0) = ""
  // last = slice(0 + 0) = "hello"
  assert(result.length === 2);
  assert(result[0] === '');
  assert(result[1] === 'hello');
});

test('Strings.splitOnFirst with multi-character separator', async () => {
  const result = Strings.splitOnFirst('hello::world', '::');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === 'world');
});

test('Strings.splitOnFirst with substring separator', async () => {
  const result = Strings.splitOnFirst('hello|world|foo', '|');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === 'world|foo');
});

test('Strings.splitOnFirst with unicode characters', async () => {
  const result = Strings.splitOnFirst('hello🎉world', '🎉');

  assert(result.length === 2);
  assert(result[0] === 'hello');
  assert(result[1] === 'world');
});

test('Strings.splitOnFirst case sensitive', async () => {
  const result = Strings.splitOnFirst('HELLO:world', ':');

  assert(result.length === 2);
  assert(result[0] === 'HELLO');
  assert(result[1] === 'world');
});
