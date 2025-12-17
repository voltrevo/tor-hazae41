import { Bytes } from '../../../bytes';
import { assert, test } from '../../../phobos/mod';
import { getCryptoRandomOrNull } from './index';

test('cryptoRandom', async () => {
  const array = Bytes.from([0, 1, 2, 3, 4, 5]);
  const result = getCryptoRandomOrNull(array)!;
  assert(array.includes(result));
});
