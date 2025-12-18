import { test } from '../../../phobos/mod';
import { assert } from '../../../../utils/assert';
import {
  InvalidHttpStatusCode,
  InvalidHttpHeaderValue,
  UnexpectedContinuationFrameError,
  ExpectedContinuationFrameError,
} from './errors.js';

test('InvalidHttpStatusCode - constructor without status', async () => {
  const error = new InvalidHttpStatusCode();

  assert(error instanceof Error);
  assert(error instanceof InvalidHttpStatusCode);
  assert(error.status === undefined);
  assert(error.message === 'Invalid HTTP status code undefined');
});

test('InvalidHttpStatusCode - constructor with status', async () => {
  const error = new InvalidHttpStatusCode(404);

  assert(error instanceof Error);
  assert(error instanceof InvalidHttpStatusCode);
  assert(error.status === 404);
  assert(error.message === 'Invalid HTTP status code 404');
});

test('InvalidHttpStatusCode - with various status codes', async () => {
  const testCodes = [200, 301, 400, 401, 403, 404, 500, 502, 503];

  for (const code of testCodes) {
    const error = new InvalidHttpStatusCode(code);
    assert(error.status === code);
    assert(error.message.includes(String(code)));
  }
});

test('InvalidHttpStatusCode - with zero status', async () => {
  const error = new InvalidHttpStatusCode(0);

  assert(error.status === 0);
  assert(error.message === 'Invalid HTTP status code 0');
});

test('InvalidHttpStatusCode - with negative status', async () => {
  const error = new InvalidHttpStatusCode(-1);

  assert(error.status === -1);
  assert(error.message.includes('-1'));
});

test('InvalidHttpStatusCode - is throwable', async () => {
  try {
    throw new InvalidHttpStatusCode(500);
  } catch (e) {
    assert(e instanceof InvalidHttpStatusCode);
    assert((e as InvalidHttpStatusCode).status === 500);
  }
});

test('InvalidHttpHeaderValue - constructor with header name', async () => {
  const error = new InvalidHttpHeaderValue('Content-Type');

  assert(error instanceof Error);
  assert(error instanceof InvalidHttpHeaderValue);
  // Note: The name property is not explicitly set in this class
  assert(error.message === 'Invalid "Content-Type" header value');
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
    assert(error.message.includes(header));
  }
});

test('InvalidHttpHeaderValue - is throwable', async () => {
  try {
    throw new InvalidHttpHeaderValue('Custom-Header');
  } catch (e) {
    assert(e instanceof InvalidHttpHeaderValue);
    // The message should contain the header name
    assert((e as Error).message.includes('Custom-Header'));
  }
});

test('UnexpectedContinuationFrameError - constructor', async () => {
  const error = new UnexpectedContinuationFrameError();

  assert(error instanceof Error);
  assert(error instanceof UnexpectedContinuationFrameError);
  assert(error.message === 'Did not expect a continuation frame');
});

test('UnexpectedContinuationFrameError - is throwable', async () => {
  try {
    throw new UnexpectedContinuationFrameError();
  } catch (e) {
    assert(e instanceof UnexpectedContinuationFrameError);
    assert((e as Error).message === 'Did not expect a continuation frame');
  }
});

test('ExpectedContinuationFrameError - constructor', async () => {
  const error = new ExpectedContinuationFrameError();

  assert(error instanceof Error);
  assert(error instanceof ExpectedContinuationFrameError);
  assert(error.name === 'ExpectedContinuationFrameError');
  assert(error.message === 'Expected a continuation frame');
});

test('ExpectedContinuationFrameError - is throwable', async () => {
  try {
    throw new ExpectedContinuationFrameError();
  } catch (e) {
    assert(e instanceof ExpectedContinuationFrameError);
    assert((e as Error).message === 'Expected a continuation frame');
  }
});

test('WebSocket frame errors are distinguishable', async () => {
  const unexpected = new UnexpectedContinuationFrameError();
  const expected = new ExpectedContinuationFrameError();

  assert(unexpected instanceof UnexpectedContinuationFrameError);
  assert(!(unexpected instanceof ExpectedContinuationFrameError));
  assert(expected instanceof ExpectedContinuationFrameError);
  assert(!(expected instanceof UnexpectedContinuationFrameError));
});

test('All error types extend Error', async () => {
  const errors = [
    new InvalidHttpStatusCode(404),
    new InvalidHttpHeaderValue('test'),
    new UnexpectedContinuationFrameError(),
    new ExpectedContinuationFrameError(),
  ];

  for (const error of errors) {
    assert(error instanceof Error);
    assert(typeof error.message === 'string');
    assert(error.message.length > 0);
  }
});
