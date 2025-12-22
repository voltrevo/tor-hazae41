/**
 * Selects a random element from an array using CSPRNG.
 *
 * Uses crypto.getRandomValues for cryptographically secure random selection.
 * This is important for security-sensitive operations like Tor relay selection.
 *
 * @param array The array to select from
 * @returns A random element from the array
 * @throws Error if the array is empty
 *
 * @example
 * ```typescript
 * const items = ['a', 'b', 'c'];
 * const selected = selectRandomElement(items);
 * ```
 */
import { assert } from './assert.js';

export function selectRandomElement<T>(array: T[]): T {
  assert(array.length !== 0, 'Cannot select from empty array');
  const randomBytes = new Uint32Array(1);

  const max = Math.floor(0xffffffff / array.length) * array.length;
  let randomValue: number;
  do {
    crypto.getRandomValues(randomBytes);
    randomValue = randomBytes[0];
  } while (randomValue >= max);

  const index = randomValue % array.length;
  return array[index];
}
