import { decodeOnionStylePubKey } from './decodeOnionStylePubkey.js';

export async function decodeOnionPubKey(host: string): Promise<Uint8Array> {
  if (!host.endsWith('.onion')) {
    throw new Error('not a .onion address');
  }

  const encodedKey = host.slice(0, -'.onion'.length);

  return await decodeOnionStylePubKey(encodedKey);
}
