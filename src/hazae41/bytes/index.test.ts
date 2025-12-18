import { assert, test } from '../phobos/mod';
import { Bytes } from '.';

test('padStart', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);

  const identity = Bytes.padStart(bytes, 2);
  const padded = Bytes.padStart(bytes, 6);

  assert(Bytes.equals(identity, Bytes.from([1, 2, 3, 4] as const)));
  assert(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const)));
});

test('sliceOrPadStart', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);

  const sliced = Bytes.sliceOrPadStart(bytes, 2);
  const padded = Bytes.sliceOrPadStart(bytes, 6);

  assert(Bytes.equals(sliced, Bytes.from([3, 4] as const)));
  assert(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const)));
});

test('indexof', async () => {
  const bytes = Bytes.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([0] as const)) === 0);

  assert(Bytes.indexOf(bytes, Bytes.from([0, 1] as const)) === 0);
  assert(Bytes.indexOf(bytes, Bytes.from([1, 0] as const)) === -1);

  assert(Bytes.indexOf(bytes, Bytes.from([1, 2] as const)) === 1);
  assert(Bytes.indexOf(bytes, Bytes.from([8, 9] as const)) === 8);

  assert(Bytes.indexOf(bytes, Bytes.from([9] as const)) === 9);
  assert(Bytes.indexOf(bytes, Bytes.from([10] as const)) === -1);

  assert(Bytes.indexOf(bytes, bytes) === 0);
});

test('indexof2', async () => {
  const bytes = Bytes.from([1, 2, 3, 1, 2, 3, 1, 2, 3] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([1, 2] as const), 2) === 3);
});

test('indexof3', async () => {
  const bytes = Bytes.from([0, 1, 0, 2, 0, 3, 0, 4] as const);

  assert(Bytes.indexOf(bytes, Bytes.from([0, 2] as const)) === 2);
});
