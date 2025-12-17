import { test } from '../hazae41/phobos/mod';
import { assert } from './assert';
import { getErrorDetails } from './getErrorDetails.js';

type ErrorWithCause = Error & { cause?: Error };

test('getErrorDetails - with Error object', async () => {
  const error = new Error('Test error message');
  const result = getErrorDetails(error);

  assert(typeof result === 'string');
  assert(result.includes('Error'));
  assert(result.includes('Test error message'));
});

test('getErrorDetails - with Error that has stack trace', async () => {
  const error = new Error('Test error');
  error.stack = 'Error: Test error\n    at line 1\n    at line 2';

  const result = getErrorDetails(error);
  assert(result.includes('Error: Test error'));
  assert(result.includes('at line 1'));
});

test('getErrorDetails - with stack that includes name but not message', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'CustomError\n    at line 1';

  const result = getErrorDetails(error);
  assert(result.includes('CustomError'));
  assert(result.includes('Test error'));
});

test('getErrorDetails - with stack that includes message but not name', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'Test error\n    at line 1';

  const result = getErrorDetails(error);
  assert(result.includes('CustomError'));
  assert(result.includes('Test error'));
});

test('getErrorDetails - with stack missing both name and message', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = 'SomeOtherText\n    at line 1';

  const result = getErrorDetails(error);
  assert(result.includes('CustomError'));
  assert(result.includes('Test error'));
  assert(result.includes('Stack:'));
});

test('getErrorDetails - with Error without stack', async () => {
  const error = new Error('Test error');
  error.name = 'CustomError';
  error.stack = undefined;

  const result = getErrorDetails(error);
  assert(result.includes('CustomError'));
  assert(result.includes('Test error'));
  assert(!result.includes('Stack:'));
});

test('getErrorDetails - with Error that has cause', async () => {
  const causeError = new Error('Cause error');
  const error = new Error('Main error');
  (error as ErrorWithCause).cause = causeError;

  const result = getErrorDetails(error);
  assert(result.includes('Main error'));
  assert(result.includes('Cause:'));
  assert(result.includes('Cause error'));
});

test('getErrorDetails - with nested causes', async () => {
  const rootError = new Error('Root cause');
  const middleError = new Error('Middle error');
  (middleError as ErrorWithCause).cause = rootError;
  const topError = new Error('Top error');
  (topError as ErrorWithCause).cause = middleError;

  const result = getErrorDetails(topError);
  assert(result.includes('Top error'));
  assert(result.includes('Middle error'));
  assert(result.includes('Root cause'));
});

test('getErrorDetails - with non-Error object (object)', async () => {
  const obj = { message: 'test' };
  const result = getErrorDetails(obj);

  assert(result.includes('test'));
  assert(result.includes('message'));
});

test('getErrorDetails - with non-Error plain object with constructor', async () => {
  class CustomClass {
    constructor() {}
  }

  const obj = new CustomClass();
  const result = getErrorDetails(obj);

  assert(result.includes('CustomClass'));
});

test('getErrorDetails - with non-Error null', async () => {
  const result = getErrorDetails(null);

  assert(result.includes('null'));
});

test('getErrorDetails - with non-Error undefined', async () => {
  const result = getErrorDetails(undefined);

  assert(result.includes('undefined'));
});

test('getErrorDetails - with non-Error string', async () => {
  const result = getErrorDetails('Just a string');

  assert(result.includes('Just a string'));
});

test('getErrorDetails - with non-Error number', async () => {
  const result = getErrorDetails(42);

  assert(result.includes('42'));
});

test('getErrorDetails - with non-Error boolean', async () => {
  const result = getErrorDetails(true);

  assert(result.includes('true'));
});

test('getErrorDetails - with object that has broken constructor property', async () => {
  const obj = Object.create(null);
  const result = getErrorDetails(obj);

  // Should handle gracefully without throwing
  assert(typeof result === 'string');
});

test('getErrorDetails - with Error that has both name and message in stack', async () => {
  const error = new Error('Test error');
  error.name = 'TestError';
  error.stack = 'TestError: Test error\n    at line 1';

  const result = getErrorDetails(error);
  assert(result.includes('TestError: Test error'));
  assert(result === error.stack);
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
    assert(
      result.includes('SyntaxError') || result.includes('Unexpected token')
    );
  }
});

test('getErrorDetails - with TypeError', async () => {
  const error = new TypeError('Cannot read property');
  const result = getErrorDetails(error);

  assert(result.includes('TypeError'));
  assert(result.includes('Cannot read property'));
});
