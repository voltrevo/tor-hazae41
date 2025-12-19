// deno-lint-ignore-file require-await
import { test, expect } from 'vitest';
import { Cursor } from './index';
import { Bytes } from '../bytes';

test('write then read', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);
  const cursor = new Cursor(Bytes.alloc(bytes.length));

  cursor.writeOrThrow(bytes);
  expect(cursor.offset === bytes.length).toBe(true);
  expect(Bytes.equals(cursor.bytes, bytes)).toBe(true);

  cursor.offset = 0;

  const bytes2 = cursor.readOrThrow(bytes.length);
  expect(cursor.offset === bytes.length).toBe(true);
  expect(Bytes.equals(cursor.bytes, bytes2)).toBe(true);

  expect(bytes.length === bytes2.length).toBe(true);
  expect(Bytes.equals(bytes, bytes2)).toBe(true);

  const overflowing = Bytes.from([1, 2, 3, 4, 5]);

  expect(() => cursor.writeOrThrow(overflowing)).toThrow();
  expect(() => cursor.readOrThrow(overflowing.length)).toThrow();
});

test('writeUint8 then readUint8', async () => {
  const cursor = new Cursor(Bytes.alloc(1));

  const n = 42;

  cursor.writeUint8OrThrow(n);
  expect(cursor.offset === 1).toBe(true);
  expect(cursor.length === 1).toBe(true);
  expect(Bytes.equals(cursor.bytes, Bytes.from([n]))).toBe(true);

  cursor.offset = 0;

  const n2 = cursor.readUint8OrThrow();
  expect(cursor.offset === 1).toBe(true);
  expect(cursor.length === 1).toBe(true);
  expect(Bytes.equals(cursor.bytes, Bytes.from([n]))).toBe(true);

  expect(n === n2).toBe(true);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint8(2 ** 8).ignore().isErr())
  // assert(cursor.tryWriteUint8(-1).ignore().isErr())
});

test('writeUint16 then readUint16', async () => {
  const cursor = new Cursor(Bytes.alloc(2));

  const n = 42;

  cursor.writeUint16OrThrow(n);
  expect(cursor.offset === 2).toBe(true);
  expect(cursor.length === 2).toBe(true);

  cursor.offset = 0;

  const n2 = cursor.readUint16OrThrow();
  expect(cursor.offset === 2).toBe(true);
  expect(cursor.length === 2).toBe(true);

  expect(n === n2).toBe(true);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint16(2 ** 16).ignore().isErr())
  // assert(cursor.tryWriteUint16(-1).ignore().isErr())
});

test('writeUint24 then readUint24', async () => {
  const cursor = new Cursor(Bytes.alloc(3));

  const n = 42;

  cursor.writeUint24OrThrow(n);
  expect(cursor.offset === 3).toBe(true);
  expect(cursor.length === 3).toBe(true);

  cursor.offset = 0;

  const n2 = cursor.readUint24OrThrow();
  expect(cursor.offset === 3).toBe(true);
  expect(cursor.length === 3).toBe(true);

  expect(n === n2).toBe(true);

  cursor.offset = 0;

  // assert(throws(() => cursor.writeUint24OrThrow(2 ** 24)))
  // assert(throws(() => cursor.writeUint24OrThrow(-1)))

  // Verify the written value is 42 as big-endian uint24
  const bytes = cursor.bytes;
  const value = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  expect(value === 42).toBe(true);
});

test('writeUint32 then readUint32', async () => {
  const cursor = new Cursor(Bytes.alloc(4));

  const n = 42;

  cursor.writeUint32OrThrow(n);
  expect(cursor.offset === 4).toBe(true);
  expect(cursor.length === 4).toBe(true);

  cursor.offset = 0;

  const n2 = cursor.readUint32OrThrow();
  expect(cursor.offset === 4).toBe(true);
  expect(cursor.length === 4).toBe(true);

  expect(n === n2).toBe(true);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint32(2 ** 32).ignore().isErr())
  // assert(cursor.tryWriteUint32(-1).ignore().isErr())
});
