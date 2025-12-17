import { prfOrThrow } from './prf.js';
import { Bytes } from '../../../../hazae41/bytes/index.js';
import { test } from '../../../../hazae41/phobos/mod.js';
import { assert } from '../../../../utils/assert.js';

test('PRF (master secret)', async () => {
  const premaster_secret = Bytes.random(128);

  const client_random = Bytes.random(32);
  const server_random = Bytes.random(32);

  const _start = Date.now();

  const seed = Bytes.concat(client_random, server_random);
  const result = await prfOrThrow(
    'SHA-1',
    premaster_secret,
    'master secret',
    seed,
    48
  );

  const _end = Date.now();

  assert(result.length === 48, `result length should be 48`);

  // console.info(message, 'took', end - start, 'ms');
});
