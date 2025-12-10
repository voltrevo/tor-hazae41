import { assert } from '../utils/assert.js';
import { decodeOnionStylePubKey } from './decodeOnionStylePubkey.js';

export async function decodeOnionPubKey(host: string): Promise<Uint8Array> {
  assert(host.endsWith('.onion'), 'not a .onion address');

  const encodedKey = host.slice(0, -'.onion'.length);

  return await decodeOnionStylePubKey(encodedKey);
}
