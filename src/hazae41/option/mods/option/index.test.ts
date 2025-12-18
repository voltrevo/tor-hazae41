import { assert } from '../../../../utils/assert';
import { test } from '../../../phobos/mod';
import { Some } from './some';

test('option methods', async () => {
  const mapped = new Some(3)
    .mapSync(x => x + 2)
    .mapSync(x => x * 2)
    .zip(new Some('lol')).inner;

  assert(JSON.stringify(mapped) === '[10,"lol"]');
});
