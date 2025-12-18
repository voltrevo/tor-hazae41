import { test, expect } from 'vitest';
import {
  InvalidHttpStatusCode,
  InvalidHttpHeaderValue,
  UnexpectedContinuationFrameError,
  ExpectedContinuationFrameError,
} from './errors.js';

test('InvalidHttpStatusCode - constructor without status', async () => {
  const error = new InvalidHttpStatusCode();

  expect(error instanceof Error).toBe(true);
  expect(error instanceof InvalidHttpStatusCode).toBe(true);
  expect(error.status === undefined).toBe(true);
  expect(error.message === 'Invalid HTTP status code undefined').toBe(true);
});

test('InvalidHttpStatusCode - constructor with status', async () => {
  const error = new InvalidHttpStatusCode(404);

  expect(error instanceof Error).toBe(true);
  expect(error instanceof InvalidHttpStatusCode).toBe(true);
  expect(error.status === 404).toBe(true);
  expect(error.message === 'Invalid HTTP status code 404').toBe(true);
});

test('InvalidHttpStatusCode - with various status codes', async () => {
  const testCodes = [200, 301, 400, 401, 403, 404, 500, 502, 503];

  for (const code of testCodes) {
    const error = new InvalidHttpStatusCode(code);
    expect(error.status === code).toBe(true);
    expect(error.message.includes(String(code))).toBe(true);
  }
});

test('InvalidHttpStatusCode - with zero status', async () => {
  const error = new InvalidHttpStatusCode(0);

  expect(error.status === 0).toBe(true);
  expect(error.message === 'Invalid HTTP status code 0').toBe(true);
});

test('InvalidHttpStatusCode - with negative status', async () => {
  const error = new InvalidHttpStatusCode(-1);

  expect(error.status === -1).toBe(true);
  expect(error.message.includes('-1')).toBe(true);
});

test('InvalidHttpStatusCode - is throwable', async () => {
  try {
    throw new InvalidHttpStatusCode(500);
  } catch (e) {
    expect(e instanceof InvalidHttpStatusCode).toBe(true);
    expect((e as InvalidHttpStatusCode).status === 500).toBe(true);
  }
});

test('InvalidHttpHeaderValue - constructor with header name', async () => {
  const error = new InvalidHttpHeaderValue('Content-Type');

  expect(error instanceof Error).toBe(true);
  expect(error instanceof InvalidHttpHeaderValue).toBe(true);
  // Note: The name property is not explicitly set in this class
  expect(error.message === 'Invalid "Content-Type" header value').toBe(true);
});

test('InvalidHttpHeaderValue - with various header names', async () => {
  const testHeaders = [
    'Content-Type',
    'Content-Length',
    'Transfer-Encoding',
    'Authorization',
    'Accept-Encoding',
  ];

  for (const header of testHeaders) {
    const error = new InvalidHttpHeaderValue(header);
    expect(error.message.includes(header)).toBe(true);
  }
});

test('InvalidHttpHeaderValue - is throwable', async () => {
  try {
    throw new InvalidHttpHeaderValue('Custom-Header');
  } catch (e) {
    expect(e instanceof InvalidHttpHeaderValue).toBe(true);
    // The message should contain the header name
    expect((e as Error).message.includes('Custom-Header')).toBe(true);
  }
});

test('UnexpectedContinuationFrameError - constructor', async () => {
  const error = new UnexpectedContinuationFrameError();

  expect(error instanceof Error).toBe(true);
  expect(error instanceof UnexpectedContinuationFrameError).toBe(true);
  expect(error.message === 'Did not expect a continuation frame').toBe(true);
});

test('UnexpectedContinuationFrameError - is throwable', async () => {
  try {
    throw new UnexpectedContinuationFrameError();
  } catch (e) {
    expect(e instanceof UnexpectedContinuationFrameError).toBe(true);
    expect((e as Error).message === 'Did not expect a continuation frame').toBe(
      true
    );
  }
});

test('ExpectedContinuationFrameError - constructor', async () => {
  const error = new ExpectedContinuationFrameError();

  expect(error instanceof Error).toBe(true);
  expect(error instanceof ExpectedContinuationFrameError).toBe(true);
  expect(error.name === 'ExpectedContinuationFrameError').toBe(true);
  expect(error.message === 'Expected a continuation frame').toBe(true);
});

test('ExpectedContinuationFrameError - is throwable', async () => {
  try {
    throw new ExpectedContinuationFrameError();
  } catch (e) {
    expect(e instanceof ExpectedContinuationFrameError).toBe(true);
    expect((e as Error).message === 'Expected a continuation frame').toBe(true);
  }
});

test('WebSocket frame errors are distinguishable', async () => {
  const unexpected = new UnexpectedContinuationFrameError();
  const expected = new ExpectedContinuationFrameError();

  expect(unexpected instanceof UnexpectedContinuationFrameError).toBe(true);
  expect(unexpected instanceof ExpectedContinuationFrameError).toBe(false);
  expect(expected instanceof ExpectedContinuationFrameError).toBe(true);
  expect(expected instanceof UnexpectedContinuationFrameError).toBe(false);
});

test('All error types extend Error', async () => {
  const errors = [
    new InvalidHttpStatusCode(404),
    new InvalidHttpHeaderValue('test'),
    new UnexpectedContinuationFrameError(),
    new ExpectedContinuationFrameError(),
  ];

  for (const error of errors) {
    expect(error instanceof Error).toBe(true);
    expect(typeof error.message === 'string').toBe(true);
    expect(error.message.length > 0).toBe(true);
  }
});
