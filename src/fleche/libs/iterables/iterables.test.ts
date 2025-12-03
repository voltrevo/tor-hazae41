import { test } from '@hazae41/phobos';
import { Iterators } from './iterators.js';

const array = [1, 2, 3, 4, 5];

test('peek', async () => {
  for (const { current, next } of Iterators.peek(array.values()))
    console.log(current, next);
});
