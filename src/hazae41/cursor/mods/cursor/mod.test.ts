// deno-lint-ignore-file require-await
import { assert, test, throws } from '../../../phobos/mod';
import { Cursor } from './mod';
import { Bytes } from '../../../bytes';

test('write then read', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);
  const cursor = new Cursor(Bytes.alloc(bytes.length));

  cursor.writeOrThrow(bytes);
  assert(cursor.offset === bytes.length);
  assert(Bytes.equals(cursor.bytes, bytes));

  cursor.offset = 0;

  const bytes2 = cursor.readOrThrow(bytes.length);
  assert(cursor.offset === bytes.length);
  assert(Bytes.equals(cursor.bytes, bytes2));

  assert(bytes.length === bytes2.length);
  assert(Bytes.equals(bytes, bytes2));

  const overflowing = Bytes.from([1, 2, 3, 4, 5]);

  assert(throws(() => cursor.writeOrThrow(overflowing)));
  assert(throws(() => cursor.readOrThrow(overflowing.length)));
});

test('writeUint8 then readUint8', async () => {
  const cursor = new Cursor(Bytes.alloc(1));

  const n = 42;

  cursor.writeUint8OrThrow(n);
  assert(cursor.offset === 1);
  assert(cursor.length === 1);
  assert(Bytes.equals(cursor.bytes, Bytes.from([n])));

  cursor.offset = 0;

  const n2 = cursor.readUint8OrThrow();
  assert(cursor.offset === 1);
  assert(cursor.length === 1);
  assert(Bytes.equals(cursor.bytes, Bytes.from([n])));

  assert(n === n2);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint8(2 ** 8).ignore().isErr())
  // assert(cursor.tryWriteUint8(-1).ignore().isErr())
});

test('writeUint16 then readUint16', async () => {
  const cursor = new Cursor(Bytes.alloc(2));

  const n = 42;

  cursor.writeUint16OrThrow(n);
  assert(cursor.offset === 2);
  assert(cursor.length === 2);

  cursor.offset = 0;

  const n2 = cursor.readUint16OrThrow();
  assert(cursor.offset === 2);
  assert(cursor.length === 2);

  assert(n === n2);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint16(2 ** 16).ignore().isErr())
  // assert(cursor.tryWriteUint16(-1).ignore().isErr())
});

test('writeUint24 then readUint24', async () => {
  const cursor = new Cursor(Bytes.alloc(3));

  const n = 42;

  cursor.writeUint24OrThrow(n);
  assert(cursor.offset === 3);
  assert(cursor.length === 3);

  cursor.offset = 0;

  const n2 = cursor.readUint24OrThrow();
  assert(cursor.offset === 3);
  assert(cursor.length === 3);

  assert(n === n2);

  cursor.offset = 0;

  // assert(throws(() => cursor.writeUint24OrThrow(2 ** 24)))
  // assert(throws(() => cursor.writeUint24OrThrow(-1)))

  // Verify the written value is 42 as big-endian uint24
  const bytes = cursor.bytes;
  const value = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  assert(value === 42);
});

test('writeUint32 then readUint32', async () => {
  const cursor = new Cursor(Bytes.alloc(4));

  const n = 42;

  cursor.writeUint32OrThrow(n);
  assert(cursor.offset === 4);
  assert(cursor.length === 4);

  cursor.offset = 0;

  const n2 = cursor.readUint32OrThrow();
  assert(cursor.offset === 4);
  assert(cursor.length === 4);

  assert(n === n2);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint32(2 ** 32).ignore().isErr())
  // assert(cursor.tryWriteUint32(-1).ignore().isErr())
});
