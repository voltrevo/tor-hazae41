import { test, expect } from 'vitest';
import { Bitset } from '.';

test('Identity', async () => {
  const bitset = new Bitset(0b00000000, 8);

  expect(bitset.getBE(0) === false).toBe(true);
  expect(bitset.toString() === '00000000').toBe(true);
});

test('Enable then disable', async () => {
  const bitset = new Bitset(0b00000000, 8);

  bitset.enableLE(1);
  expect(bitset.getLE(1) === true).toBe(true);
  expect(bitset.toString() === '00000010').toBe(true);

  bitset.disableLE(1);
  expect(bitset.getLE(1) === false).toBe(true);
  expect(bitset.toString() === '00000000').toBe(true);

  bitset.enableBE(1);
  expect(bitset.getBE(1) === true).toBe(true);
  expect(bitset.toString() === '01000000').toBe(true);

  bitset.disableBE(1);
  expect(bitset.getBE(1) === false).toBe(true);
  expect(bitset.toString() === '00000000').toBe(true);
});

test('Toggle then toggle', async () => {
  const bitset = new Bitset(0b00000000, 8);

  bitset.toggleLE(1);
  expect(bitset.getLE(1) === true).toBe(true);
  expect(bitset.toString() === '00000010').toBe(true);

  bitset.toggleLE(1);
  expect(bitset.getLE(1) === false).toBe(true);
  expect(bitset.toString() === '00000000').toBe(true);

  bitset.toggleBE(1);
  expect(bitset.getBE(1) === true).toBe(true);
  expect(bitset.toString() === '01000000').toBe(true);

  bitset.toggleBE(1);
  expect(bitset.getBE(1) === false).toBe(true);
  expect(bitset.toString() === '00000000').toBe(true);
});

test('Export Int32 to Uint32', async () => {
  const bitset = new Bitset(0, 32);

  bitset.toggleBE(0);
  expect(bitset.value === -2147483648).toBe(true);

  bitset.unsign();
  expect(bitset.value === (2147483648 as number)).toBe(true);
});

test('First', async () => {
  const bitset = new Bitset(0b11100011, 8);

  expect(bitset.first(2).value === 3).toBe(true);
  expect(bitset.first(3).value === 7).toBe(true);
});

test('Last', async () => {
  const bitset = new Bitset(0b11100111, 8);

  expect(bitset.last(2).value === 3).toBe(true);
  expect(bitset.last(3).value === 7).toBe(true);
});
