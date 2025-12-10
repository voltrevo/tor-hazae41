import { test } from '@hazae41/phobos';
import { assert } from '../../../utils/assert';
import { Buffers } from './buffers.js';

test('Buffers.fromView with Uint8Array', async () => {
  const array = new Uint8Array([1, 2, 3, 4, 5]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 5);
  assert(buffer[0] === 1);
  assert(buffer[4] === 5);
});

test('Buffers.fromView with Uint16Array', async () => {
  const array = new Uint16Array([256, 512, 1024]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 6); // 3 * 2 bytes
});

test('Buffers.fromView with Uint32Array', async () => {
  const array = new Uint32Array([100000, 200000]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 8); // 2 * 4 bytes
});

test('Buffers.fromView with Float32Array', async () => {
  const array = new Float32Array([1.5, 2.5, 3.5]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 12); // 3 * 4 bytes
});

test('Buffers.fromView with Int8Array', async () => {
  const array = new Int8Array([-1, 0, 1, 127, -128]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 5);
});

test('Buffers.fromView with offset ArrayBuffer', async () => {
  const ab = new ArrayBuffer(10);
  const view = new Uint8Array(ab, 2, 5); // offset 2, length 5
  view[0] = 100;
  view[1] = 101;

  const buffer = Buffers.fromView(view);

  assert(buffer.length === 5);
  assert(buffer[0] === 100);
  assert(buffer[1] === 101);
});

test('Buffers.fromView preserves data after modification', async () => {
  const array = new Uint8Array([10, 20, 30]);
  const buffer = Buffers.fromView(array);

  // Modify original array
  array[0] = 99;

  // Buffer should reflect the change (they share the same underlying buffer)
  assert(buffer[0] === 99);
});

test('Buffers.fromView with empty view', async () => {
  const array = new Uint8Array(0);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 0);
});

test('Buffers.fromView with DataView', async () => {
  const ab = new ArrayBuffer(8);
  const view = new DataView(ab);
  view.setUint32(0, 0x12345678);

  const buffer = Buffers.fromView(view);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 8);
});

test('Buffers.fromView with BigInt64Array', async () => {
  const array = new BigInt64Array([123n, 456n]);
  const buffer = Buffers.fromView(array);

  assert(Buffer.isBuffer(buffer));
  assert(buffer.length === 16); // 2 * 8 bytes
});

test('Buffers.fromView with large array', async () => {
  const array = new Uint8Array(1000);
  for (let i = 0; i < array.length; i++) {
    array[i] = i % 256;
  }

  const buffer = Buffers.fromView(array);

  assert(buffer.length === 1000);
  assert(buffer[0] === 0);
  assert(buffer[255] === 255);
  assert(buffer[256] === 0); // wraps around
  assert(buffer[999] === 231); // 999 % 256 = 231
});
