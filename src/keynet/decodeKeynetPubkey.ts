import { assert } from '../utils/assert.js';
import { decodeOnionStylePubKey } from '../hiddenServices/decodeOnionStylePubkey.js';

export async function decodeKeynetPubKey(host: string): Promise<Uint8Array> {
  assert(host.endsWith('.keynet'), 'not a .keynet address');

  const encodedKey = host.slice(0, -'.keynet'.length);

  return await decodeOnionStylePubKey(encodedKey);
}
