/**
 * Selects a random element from an array.
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
export function selectRandomElement<T>(array: T[]): T {
  if (array.length === 0) {
    throw new Error('Cannot select from empty array');
  }
  const index = Math.floor(Math.random() * array.length);
  return array[index];
}
