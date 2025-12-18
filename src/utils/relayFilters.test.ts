/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from 'vitest';
import { isMiddleRelay, isExitRelay } from './relayFilters';

interface MockRelay {
  flags: string[];
}

function createRelay(flags: string[]): MockRelay {
  return { flags };
}

test('isMiddleRelay: should accept relay with required flags', async () => {
  const relay = createRelay([
    'Fast',
    'Stable',
    'V2Dir',
    'Guard',
    'Exit',
  ]) as any;
  expect(isMiddleRelay(relay)).toBe(true);
});

test('isMiddleRelay: should reject relay missing V2Dir flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Guard']) as any;
  expect(!isMiddleRelay(relay)).toBe(true);
});

test('isMiddleRelay: should reject relay missing Stable flag', async () => {
  const relay = createRelay(['Fast', 'V2Dir']) as any;
  expect(!isMiddleRelay(relay)).toBe(true);
});

test('isMiddleRelay: should reject relay missing Fast flag', async () => {
  const relay = createRelay(['Stable', 'V2Dir']) as any;
  expect(!isMiddleRelay(relay)).toBe(true);
});

test('isMiddleRelay: should reject relay with empty flags', async () => {
  const relay = createRelay([]) as any;
  expect(!isMiddleRelay(relay)).toBe(true);
});

test('isExitRelay: should accept relay with required flags', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Exit', 'Guard']) as any;
  expect(isExitRelay(relay)).toBe(true);
});

test('isExitRelay: should reject relay with BadExit flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Exit', 'BadExit']) as any;
  expect(!isExitRelay(relay)).toBe(true);
});

test('isExitRelay: should reject relay missing Exit flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Guard']) as any;
  expect(!isExitRelay(relay)).toBe(true);
});

test('isExitRelay: should reject relay missing Stable flag', async () => {
  const relay = createRelay(['Fast', 'Exit']) as any;
  expect(!isExitRelay(relay)).toBe(true);
});

test('isExitRelay: should reject relay missing Fast flag', async () => {
  const relay = createRelay(['Stable', 'Exit']) as any;
  expect(!isExitRelay(relay)).toBe(true);
});

test('isExitRelay: should reject relay with empty flags', async () => {
  const relay = createRelay([]) as any;
  expect(!isExitRelay(relay)).toBe(true);
});
