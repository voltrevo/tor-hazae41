import { test, expect } from 'vitest';
import { getErrorDetails } from './getErrorDetails.js';

type ErrorWithCause = Error & { cause?: Error };

test('getErrorDetails - with Error object', async () => {
  const error = new Error('Test error message');
  const result = getErrorDetails(error);

  expect(typeof result === 'string').toBe(true);
  expect(result.includes('Error')).toBe(true);
  expect(result.includes('Test error message')).toBe(true);
});

test('getErrorDetails - with Error that has stack trace', async () => {
  const error = new Error('Test error');
  error.stack = 'Error: Test error\n    at line 1\n    at line 2';

  const result = getErrorDetails(error);
  expect(result.includes('Error: Test error')).toBe(true);
  expect(result.includes('at line 1')).toBe(true);
});

test('getErrorDetails - with stack that includes name but not message', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'CustomError\n    at line 1';

  const result = getErrorDetails(error);
  expect(result.includes('CustomError')).toBe(true);
  expect(result.includes('Test error')).toBe(true);
});

test('getErrorDetails - with stack that includes message but not name', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'Test error\n    at line 1';

  const result = getErrorDetails(error);
  expect(result.includes('CustomError')).toBe(true);
  expect(result.includes('Test error')).toBe(true);
});

test('getErrorDetails - with stack missing both name and message', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'SomeOtherText\n    at line 1';

  const result = getErrorDetails(error);
  expect(result.includes('CustomError')).toBe(true);
  expect(result.includes('Test error')).toBe(true);
  expect(result.includes('Stack:')).toBe(true);
});

test('getErrorDetails - with Error without stack', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = undefined;

  const result = getErrorDetails(error);
  expect(result.includes('CustomError')).toBe(true);
  expect(result.includes('Test error')).toBe(true);
  expect(!result.includes('Stack:')).toBe(true);
});

test('getErrorDetails - with Error that has cause', async () => {
  const causeError = new Error('Cause error');
  const error = new Error('Main error');
  (error as ErrorWithCause).cause = causeError;

  const result = getErrorDetails(error);
  expect(result.includes('Main error')).toBe(true);
  expect(result.includes('Cause:')).toBe(true);
  expect(result.includes('Cause error')).toBe(true);
});

test('getErrorDetails - with nested causes', async () => {
  const rootError = new Error('Root cause');
  const middleError = new Error('Middle error');
  (middleError as ErrorWithCause).cause = rootError;
  const topError = new Error('Top error');
  (topError as ErrorWithCause).cause = middleError;

  const result = getErrorDetails(topError);
  expect(result.includes('Top error')).toBe(true);
  expect(result.includes('Middle error')).toBe(true);
  expect(result.includes('Root cause')).toBe(true);
});

test('getErrorDetails - with non-Error object (object)', async () => {
  const obj = { message: 'test' };
  const result = getErrorDetails(obj);

  expect(result.includes('test')).toBe(true);
  expect(result.includes('message')).toBe(true);
});

test('getErrorDetails - with non-Error plain object with constructor', async () => {
  class CustomClass {
    constructor() {}
  }

  const obj = new CustomClass();
  const result = getErrorDetails(obj);

  expect(result.includes('CustomClass')).toBe(true);
});

test('getErrorDetails - with non-Error null', async () => {
  const result = getErrorDetails(null);

  expect(result.includes('null')).toBe(true);
});

test('getErrorDetails - with non-Error undefined', async () => {
  const result = getErrorDetails(undefined);

  expect(result.includes('undefined')).toBe(true);
});

test('getErrorDetails - with non-Error string', async () => {
  const result = getErrorDetails('Just a string');

  expect(result.includes('Just a string')).toBe(true);
});

test('getErrorDetails - with non-Error number', async () => {
  const result = getErrorDetails(42);

  expect(result.includes('42')).toBe(true);
});

test('getErrorDetails - with non-Error boolean', async () => {
  const result = getErrorDetails(true);

  expect(result.includes('true')).toBe(true);
});

test('getErrorDetails - with object that has broken constructor property', async () => {
  const obj = Object.create(null);
  const result = getErrorDetails(obj);

  // Should handle gracefully without throwing
  expect(typeof result === 'string').toBe(true);
});

test('getErrorDetails - with Error that has both name and message in stack', async () => {
  const error = new Error('Test error');
  error.name = 'TestError';
  error.stack = 'TestError: Test error\n    at line 1';

  const result = getErrorDetails(error);
  expect(result.includes('TestError: Test error')).toBe(true);
  expect(result === error.stack).toBe(true);
});

test('getErrorDetails - with SyntaxError', async () => {
  let error: SyntaxError;
  try {
    eval('invalid syntax {');
  } catch (e) {
    error = e as SyntaxError;
  }

  if (error!) {
    const result = getErrorDetails(error);
    expect(
      result.includes('SyntaxError') || result.includes('Unexpected token')
    ).toBe(true);
  }
});

test('getErrorDetails - with TypeError', async () => {
  const error = new TypeError('Cannot read property');
  const result = getErrorDetails(error);

  expect(result.includes('TypeError')).toBe(true);
  expect(result.includes('Cannot read property')).toBe(true);
});
