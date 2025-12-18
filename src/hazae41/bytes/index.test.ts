import { test, expect } from 'vitest';
import { Bytes } from '.';

test('padStart', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);

  const identity = Bytes.padStart(bytes, 2);
  const padded = Bytes.padStart(bytes, 6);

  expect(Bytes.equals(identity, Bytes.from([1, 2, 3, 4] as const))).toBe(true);
  expect(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const))).toBe(
    true
  );
});

test('sliceOrPadStart', async () => {
  const bytes = Bytes.from([1, 2, 3, 4]);

  const sliced = Bytes.sliceOrPadStart(bytes, 2);
  const padded = Bytes.sliceOrPadStart(bytes, 6);

  expect(Bytes.equals(sliced, Bytes.from([3, 4] as const))).toBe(true);
  expect(Bytes.equals(padded, Bytes.from([0, 0, 1, 2, 3, 4] as const))).toBe(
    true
  );
});

test('indexof', async () => {
  const bytes = Bytes.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const);

  expect(Bytes.indexOf(bytes, Bytes.from([0] as const)) === 0).toBe(true);

  expect(Bytes.indexOf(bytes, Bytes.from([0, 1] as const)) === 0).toBe(true);
  expect(Bytes.indexOf(bytes, Bytes.from([1, 0] as const)) === -1).toBe(true);

  expect(Bytes.indexOf(bytes, Bytes.from([1, 2] as const)) === 1).toBe(true);
  expect(Bytes.indexOf(bytes, Bytes.from([8, 9] as const)) === 8).toBe(true);

  expect(Bytes.indexOf(bytes, Bytes.from([9] as const)) === 9).toBe(true);
  expect(Bytes.indexOf(bytes, Bytes.from([10] as const)) === -1).toBe(true);

  expect(Bytes.indexOf(bytes, bytes) === 0).toBe(true);
});

test('indexof2', async () => {
  const bytes = Bytes.from([1, 2, 3, 1, 2, 3, 1, 2, 3] as const);

  expect(Bytes.indexOf(bytes, Bytes.from([1, 2] as const), 2) === 3).toBe(true);
});

test('indexof3', async () => {
  const bytes = Bytes.from([0, 1, 0, 2, 0, 3, 0, 4] as const);

  expect(Bytes.indexOf(bytes, Bytes.from([0, 2] as const)) === 2).toBe(true);
});
