import { test } from '../../../hazae41/phobos/mod';
import { Iterators } from './iterators.js';

const array = [1, 2, 3, 4, 5];
const debug = false;

test('peek', async () => {
  for (const { current, next } of Iterators.peek(array.values())) {
    if (debug) {
      console.log(current, next);
    }
  }
});
