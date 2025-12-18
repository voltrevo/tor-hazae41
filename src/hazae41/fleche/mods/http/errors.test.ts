import { test } from '../../../phobos/mod';
import { assert } from '../../../../utils/assert';
import {
  InvalidHttpStateError,
  UnsupportedContentEncoding,
  UnsupportedTransferEncoding,
  ContentLengthOverflowError,
} from './errors.js';

test('InvalidHttpStateError - constructor', async () => {
  const error = new InvalidHttpStateError();

  assert(error instanceof Error);
  assert(error instanceof InvalidHttpStateError);
  assert(error.name === 'InvalidHttpStateError');
  assert(error.message === 'Invalid state');
});

test('InvalidHttpStateError - is throwable', async () => {
  try {
    throw new InvalidHttpStateError();
  } catch (e) {
    assert(e instanceof InvalidHttpStateError);
    assert((e as Error).message === 'Invalid state');
  }
});

test('UnsupportedContentEncoding - constructor with type', async () => {
  const error = new UnsupportedContentEncoding('gzip');

  assert(error instanceof Error);
  assert(error instanceof UnsupportedContentEncoding);
  assert(error.name === 'UnsupportedContentEncoding');
  assert(error.type === 'gzip');
  assert(
    error.message === 'Unsupported "Content-Encoding" header value "gzip"'
  );
});

test('UnsupportedContentEncoding - with different types', async () => {
  const testCases = ['deflate', 'br', 'compress', 'identity', 'custom'];

  for (const type of testCases) {
    const error = new UnsupportedContentEncoding(type);
    assert(error.type === type);
    assert(error.message.includes(type));
  }
});

test('UnsupportedContentEncoding - is throwable', async () => {
  try {
    throw new UnsupportedContentEncoding('unknown');
  } catch (e) {
    assert(e instanceof UnsupportedContentEncoding);
    assert((e as UnsupportedContentEncoding).type === 'unknown');
  }
});

test('UnsupportedTransferEncoding - constructor with type', async () => {
  const error = new UnsupportedTransferEncoding('chunked');

  assert(error instanceof Error);
  assert(error instanceof UnsupportedTransferEncoding);
  assert(error.name === 'UnsupportedTransferEncoding');
  assert(error.type === 'chunked');
  assert(
    error.message === 'Unsupported "Transfer-Encoding" header value "chunked"'
  );
});

test('UnsupportedTransferEncoding - with different types', async () => {
  const testCases = ['gzip', 'deflate', 'br', 'compress'];

  for (const type of testCases) {
    const error = new UnsupportedTransferEncoding(type);
    assert(error.type === type);
    assert(error.message.includes(type));
  }
});

test('UnsupportedTransferEncoding - is throwable', async () => {
  try {
    throw new UnsupportedTransferEncoding('custom');
  } catch (e) {
    assert(e instanceof UnsupportedTransferEncoding);
    assert((e as UnsupportedTransferEncoding).type === 'custom');
  }
});

test('ContentLengthOverflowError - constructor with values', async () => {
  const error = new ContentLengthOverflowError(100, 150);

  assert(error instanceof Error);
  assert(error instanceof ContentLengthOverflowError);
  assert(error.name === 'ContentLengthOverflowError');
  assert(error.offset === 100);
  assert(error.length === 150);
  assert(
    error.message ===
      'Received 100 bytes but "Content-Length" header said it was 150 bytes'
  );
});

test('ContentLengthOverflowError - with zero offset', async () => {
  const error = new ContentLengthOverflowError(0, 100);

  assert(error.offset === 0);
  assert(error.length === 100);
  assert(error.message.includes('0 bytes'));
});

test('ContentLengthOverflowError - with large numbers', async () => {
  const error = new ContentLengthOverflowError(1000000, 2000000);

  assert(error.offset === 1000000);
  assert(error.length === 2000000);
  assert(error.message.includes('1000000'));
  assert(error.message.includes('2000000'));
});

test('ContentLengthOverflowError - is throwable', async () => {
  try {
    throw new ContentLengthOverflowError(50, 100);
  } catch (e) {
    assert(e instanceof ContentLengthOverflowError);
    const error = e as ContentLengthOverflowError;
    assert(error.offset === 50);
    assert(error.length === 100);
  }
});

test('Error hierarchy - all extend Error', async () => {
  const errors = [
    new InvalidHttpStateError(),
    new UnsupportedContentEncoding('gzip'),
    new UnsupportedTransferEncoding('chunked'),
    new ContentLengthOverflowError(10, 20),
  ];

  for (const error of errors) {
    assert(error instanceof Error);
    assert(typeof error.message === 'string');
    assert(typeof error.name === 'string');
  }
});

test('Error messages are non-empty', async () => {
  const errors = [
    new InvalidHttpStateError(),
    new UnsupportedContentEncoding('type'),
    new UnsupportedTransferEncoding('type'),
    new ContentLengthOverflowError(1, 2),
  ];

  for (const error of errors) {
    assert(error.message.length > 0, `Error ${error.name} has empty message`);
  }
});
