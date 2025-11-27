import { decodeHostnamePubKey } from './decodeHostnamePubkey.js';

export function decodeOnionPubKey(host: string): Uint8Array {
  if (!host.endsWith('.onion')) {
    throw new Error('not a .onion address');
  }

  const hostname = host.slice(0, -'.onion'.length);

  return decodeHostnamePubKey(hostname);
}
