import { test } from '../../../phobos/mod';
import { Iterators } from './iterators.js';

const array = [1, 2, 3, 4, 5];
const _debug = false;

test('peek', async () => {
  // test passes if no error
  for (const _item of Iterators.peek(array.values())) {
    // iterate over values
  }
});
