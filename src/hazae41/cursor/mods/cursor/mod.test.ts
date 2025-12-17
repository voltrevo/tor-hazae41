// deno-lint-ignore-file require-await
import { assert, test, throws } from '../../../phobos/mod.ts';
import { Buffer } from 'node:buffer';
import { relative, resolve } from 'node:path';
import { Cursor } from './mod.ts';

const directory = resolve('./dist/test/');
const { pathname } = new URL(import.meta.url);
console.log(relative(directory, pathname.replace('.mjs', '.ts')));

function equals(a: Uint8Array, b: Uint8Array) {
  return Buffer.from(a).equals(Buffer.from(b));
}

test('write then read', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const cursor = new Cursor(new Uint8Array(bytes.length));

  cursor.writeOrThrow(bytes);
  assert(cursor.offset === bytes.length);
  assert(equals(cursor.bytes, bytes));

  cursor.offset = 0;

  const bytes2 = cursor.readOrThrow(bytes.length);
  assert(cursor.offset === bytes.length);
  assert(equals(cursor.bytes, bytes2));

  assert(bytes.length === bytes2.length);
  assert(equals(bytes, bytes2));

  const overflowing = Buffer.from([1, 2, 3, 4, 5]);

  assert(throws(() => cursor.writeOrThrow(overflowing)));
  assert(throws(() => cursor.readOrThrow(overflowing.length)));
});

test('writeUint8 then readUint8', async () => {
  const cursor = new Cursor(new Uint8Array(1));

  const n = 42;

  cursor.writeUint8OrThrow(n);
  assert(cursor.offset === 1);
  assert(cursor.length === 1);
  assert(equals(cursor.bytes, new Uint8Array([n])));

  cursor.offset = 0;

  const n2 = cursor.readUint8OrThrow();
  assert(cursor.offset === 1);
  assert(cursor.length === 1);
  assert(equals(cursor.bytes, new Uint8Array([n])));

  assert(n === n2);

  cursor.offset = 0;

  // assert(cursor.tryWriteUint8(2 ** 8).ignore().isErr())
  // assert(cursor.tryWriteUint8(-1).ignore().isErr())
});

test('writeUint16 then readUint16', async () => {
  const cursor = new Cursor(new Uint8Array(2));

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
  const cursor = new Cursor(new Uint8Array(3));

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

  assert(Buffer.from(cursor.bytes).readUintBE(0, 3) === 42);
});

test('writeUint32 then readUint32', async () => {
  const cursor = new Cursor(new Uint8Array(4));

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
