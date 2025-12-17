import { Bytes } from '../hazae41/bytes/index.js';
import { assert } from '../utils/assert.js';
import { decodeOnionStylePubKey } from './decodeOnionStylePubkey.js';

export async function decodeOnionPubKey(host: string): Promise<Bytes> {
  assert(host.endsWith('.onion'), 'not a .onion address');

  const encodedKey = host.slice(0, -'.onion'.length);

  return await decodeOnionStylePubKey(encodedKey);
}
