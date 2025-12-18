import { test, expect } from 'vitest';
import { Some } from './some';

test('option methods', async () => {
  const mapped = new Some(3)
    .mapSync(x => x + 2)
    .mapSync(x => x * 2)
    .zip(new Some('lol')).inner;

  expect(JSON.stringify(mapped) === '[10,"lol"]').toBe(true);
});
