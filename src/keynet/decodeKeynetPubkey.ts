import { decodeHostnamePubKey } from '../hiddenServices/decodeHostnamePubkey.js';

export function decodeKeynetPubKey(host: string): Uint8Array {
  if (!host.endsWith('.keynet')) {
    throw new Error('not a .keynet address');
  }

  const hostname = host.slice(0, -'.keynet'.length);

  return decodeHostnamePubKey(hostname);
}
