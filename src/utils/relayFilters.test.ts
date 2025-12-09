/* eslint-disable @typescript-eslint/no-explicit-any */
import { assert, test } from '@hazae41/phobos';
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
  assert(isMiddleRelay(relay), 'Should accept relay with Fast, Stable, V2Dir');
});

test('isMiddleRelay: should reject relay missing V2Dir flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Guard']) as any;
  assert(!isMiddleRelay(relay), 'Should reject relay missing V2Dir');
});

test('isMiddleRelay: should reject relay missing Stable flag', async () => {
  const relay = createRelay(['Fast', 'V2Dir']) as any;
  assert(!isMiddleRelay(relay), 'Should reject relay missing Stable');
});

test('isMiddleRelay: should reject relay missing Fast flag', async () => {
  const relay = createRelay(['Stable', 'V2Dir']) as any;
  assert(!isMiddleRelay(relay), 'Should reject relay missing Fast');
});

test('isMiddleRelay: should reject relay with empty flags', async () => {
  const relay = createRelay([]) as any;
  assert(!isMiddleRelay(relay), 'Should reject relay with empty flags');
});

test('isExitRelay: should accept relay with required flags', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Exit', 'Guard']) as any;
  assert(isExitRelay(relay), 'Should accept relay with Fast, Stable, Exit');
});

test('isExitRelay: should reject relay with BadExit flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Exit', 'BadExit']) as any;
  assert(!isExitRelay(relay), 'Should reject relay with BadExit flag');
});

test('isExitRelay: should reject relay missing Exit flag', async () => {
  const relay = createRelay(['Fast', 'Stable', 'Guard']) as any;
  assert(!isExitRelay(relay), 'Should reject relay missing Exit');
});

test('isExitRelay: should reject relay missing Stable flag', async () => {
  const relay = createRelay(['Fast', 'Exit']) as any;
  assert(!isExitRelay(relay), 'Should reject relay missing Stable');
});

test('isExitRelay: should reject relay missing Fast flag', async () => {
  const relay = createRelay(['Stable', 'Exit']) as any;
  assert(!isExitRelay(relay), 'Should reject relay missing Fast');
});

test('isExitRelay: should reject relay with empty flags', async () => {
  const relay = createRelay([]) as any;
  assert(!isExitRelay(relay), 'Should reject relay with empty flags');
});
