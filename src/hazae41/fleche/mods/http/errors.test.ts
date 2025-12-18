import { test, expect } from 'vitest';
import {
  InvalidHttpStateError,
  UnsupportedContentEncoding,
  UnsupportedTransferEncoding,
  ContentLengthOverflowError,
} from './errors.js';

test('InvalidHttpStateError - constructor', async () => {
  const error = new InvalidHttpStateError();

  expect(error instanceof Error).toBe(true);
  expect(error instanceof InvalidHttpStateError).toBe(true);
  expect(error.name === 'InvalidHttpStateError').toBe(true);
  expect(error.message === 'Invalid state').toBe(true);
});

test('InvalidHttpStateError - is throwable', async () => {
  try {
    throw new InvalidHttpStateError();
  } catch (e) {
    expect(e instanceof InvalidHttpStateError).toBe(true);
    expect((e as Error).message === 'Invalid state').toBe(true);
  }
});

test('UnsupportedContentEncoding - constructor with type', async () => {
  const error = new UnsupportedContentEncoding('gzip');

  expect(error instanceof Error).toBe(true);
  expect(error instanceof UnsupportedContentEncoding).toBe(true);
  expect(error.name === 'UnsupportedContentEncoding').toBe(true);
  expect(error.type === 'gzip').toBe(true);
  expect(
    error.message === 'Unsupported "Content-Encoding" header value "gzip"'
  ).toBe(true);
});

test('UnsupportedContentEncoding - with different types', async () => {
  const testCases = ['deflate', 'br', 'compress', 'identity', 'custom'];

  for (const type of testCases) {
    const error = new UnsupportedContentEncoding(type);
    expect(error.type === type).toBe(true);
    expect(error.message.includes(type)).toBe(true);
  }
});

test('UnsupportedContentEncoding - is throwable', async () => {
  try {
    throw new UnsupportedContentEncoding('unknown');
  } catch (e) {
    expect(e instanceof UnsupportedContentEncoding).toBe(true);
    expect((e as UnsupportedContentEncoding).type === 'unknown').toBe(true);
  }
});

test('UnsupportedTransferEncoding - constructor with type', async () => {
  const error = new UnsupportedTransferEncoding('chunked');

  expect(error instanceof Error).toBe(true);
  expect(error instanceof UnsupportedTransferEncoding).toBe(true);
  expect(error.name === 'UnsupportedTransferEncoding').toBe(true);
  expect(error.type === 'chunked').toBe(true);
  expect(
    error.message === 'Unsupported "Transfer-Encoding" header value "chunked"'
  ).toBe(true);
});

test('UnsupportedTransferEncoding - with different types', async () => {
  const testCases = ['gzip', 'deflate', 'br', 'compress'];

  for (const type of testCases) {
    const error = new UnsupportedTransferEncoding(type);
    expect(error.type === type).toBe(true);
    expect(error.message.includes(type)).toBe(true);
  }
});

test('UnsupportedTransferEncoding - is throwable', async () => {
  try {
    throw new UnsupportedTransferEncoding('custom');
  } catch (e) {
    expect(e instanceof UnsupportedTransferEncoding).toBe(true);
    expect((e as UnsupportedTransferEncoding).type === 'custom').toBe(true);
  }
});

test('ContentLengthOverflowError - constructor with values', async () => {
  const error = new ContentLengthOverflowError(100, 150);

  expect(error instanceof Error).toBe(true);
  expect(error instanceof ContentLengthOverflowError).toBe(true);
  expect(error.name === 'ContentLengthOverflowError').toBe(true);
  expect(error.offset === 100).toBe(true);
  expect(error.length === 150).toBe(true);
  expect(
    error.message ===
      'Received 100 bytes but "Content-Length" header said it was 150 bytes'
  ).toBe(true);
});

test('ContentLengthOverflowError - with zero offset', async () => {
  const error = new ContentLengthOverflowError(0, 100);

  expect(error.offset === 0).toBe(true);
  expect(error.length === 100).toBe(true);
  expect(error.message.includes('0 bytes')).toBe(true);
});

test('ContentLengthOverflowError - with large numbers', async () => {
  const error = new ContentLengthOverflowError(1000000, 2000000);

  expect(error.offset === 1000000).toBe(true);
  expect(error.length === 2000000).toBe(true);
  expect(error.message.includes('1000000')).toBe(true);
  expect(error.message.includes('2000000')).toBe(true);
});

test('ContentLengthOverflowError - is throwable', async () => {
  try {
    throw new ContentLengthOverflowError(50, 100);
  } catch (e) {
    expect(e instanceof ContentLengthOverflowError).toBe(true);
    const error = e as ContentLengthOverflowError;
    expect(error.offset === 50).toBe(true);
    expect(error.length === 100).toBe(true);
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
    expect(error instanceof Error).toBe(true);
    expect(typeof error.message === 'string').toBe(true);
    expect(typeof error.name === 'string').toBe(true);
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
    expect(
      error.message.length > 0,
      `Error ${error.name} has empty message`
    ).toBe(true);
  }
});
