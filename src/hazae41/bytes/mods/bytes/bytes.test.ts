import { assert, test } from '../../../phobos/mod.ts';
import { Sized } from '../sized/sized';
import { Bytes } from './bytes';

function doNotRun() {
  const bytesX = Bytes.fromView(new Uint8Array(8)); // Bytes<number>

  const bytes8 = Bytes.alloc(8); // Bytes<8>

  if (Bytes.equals(bytesX, bytes8))
    bytesX; // Bytes<8>
  else bytesX; // Bytes<number>

  if (bytesX.length === bytes8.length)
    bytesX.length; // Bytes<number>.length: 8
  else bytesX; // Bytes<number>

  if (Bytes.is(bytesX, 8))
    bytesX; // Bytes<8>
  else bytesX; // Bytes<number>

  if (Bytes.is(bytes8, 16))
    bytes8; // never
  else bytes8; // Bytes<8>

  Bytes.fromViewAndCastOrThrow(bytesX, 16); // Bytes<16>
  Bytes.fromViewAndCastOrThrow(bytes8, 16); // Bytes<16>

  function test(sized: Sized<number, 8>) {
    sized.length; // 8
  }

  test([1, 2, 3, 4, 5, 6, 7, 8] as const);
  test(bytes8);
}

await test('padStart', async ({ message }) => {
  const bytes = new Uint8Array([1, 2, 3, 4]);

  const identity = Bytes.padStart(bytes, 2);
  const padded = Bytes.padStart(bytes, 6);

  assert(Bytes.equals(identity, Bytes.from([1, 2, 3, 4] as const)));
  assert(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const)));

  console.log(message);
});

await test('sliceOrPadStart', async ({ message }) => {
  const bytes = Bytes.from([1, 2, 3, 4]);

  const sliced = Bytes.sliceOrPadStart(bytes, 2);
  const padded = Bytes.sliceOrPadStart(bytes, 6);

  assert(Bytes.equals(sliced, Bytes.from([3, 4] as const)));
  assert(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const)));

  console.log(message);
});

await test('indexof', async ({ message }) => {
  const bytes = Bytes.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([0] as const)) === 0);

  assert(Bytes.indexOf(bytes, Bytes.from([0, 1] as const)) === 0);
  assert(Bytes.indexOf(bytes, Bytes.from([1, 0] as const)) === -1);

  assert(Bytes.indexOf(bytes, Bytes.from([1, 2] as const)) === 1);
  assert(Bytes.indexOf(bytes, Bytes.from([8, 9] as const)) === 8);

  assert(Bytes.indexOf(bytes, Bytes.from([9] as const)) === 9);
  assert(Bytes.indexOf(bytes, Bytes.from([10] as const)) === -1);

  assert(Bytes.indexOf(bytes, bytes) === 0);

  console.log(message);
});

await test('indexof2', async ({ message }) => {
  const bytes = Bytes.from([1, 2, 3, 1, 2, 3, 1, 2, 3] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([1, 2] as const), 2) === 3);

  console.log(message);
});

await test('indexof3', async ({ message }) => {
  const bytes = Bytes.from([0, 1, 0, 2, 0, 3, 0, 4] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([0, 2] as const)) === 2);

  console.log(message);
});
