import { test, expect } from 'vitest';
import { selectRandomElement } from './random';

test('selectRandomElement: should return the only element from single-element array', async () => {
  const array = ['only'];
  const result = selectRandomElement(array);
  expect(result === 'only').toBe(true);
});

test('selectRandomElement: should return an element from a multi-element array', async () => {
  const array = ['a', 'b', 'c', 'd', 'e'];
  const result = selectRandomElement(array);
  expect(array.includes(result)).toBe(true);
});

test('selectRandomElement: should work with different types', async () => {
  const array = [1, 2, 3, 4, 5];
  const result = selectRandomElement(array);
  expect(array.includes(result)).toBe(true);
});

test('selectRandomElement: should throw error for empty array', async () => {
  const array: string[] = [];
  let threwError = false;
  try {
    selectRandomElement(array);
  } catch {
    threwError = true;
  }
  expect(threwError).toBe(true);
});

test('selectRandomElement: should have reasonable distribution across multiple calls', async () => {
  const array = ['a', 'b', 'c'];
  const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
  const iterations = 300;

  for (let i = 0; i < iterations; i++) {
    const result = selectRandomElement(array);
    counts[result]++;
  }

  // Each element should be selected at least a few times out of 300 iterations
  // With random selection, we expect roughly 100 of each
  expect(counts.a > 0 && counts.b > 0 && counts.c > 0).toBe(true);
});
