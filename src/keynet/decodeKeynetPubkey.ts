import { decodeHostnamePubKey } from '../hiddenServices/decodeHostnamePubkey.js';

export async function decodeKeynetPubKey(host: string): Promise<Uint8Array> {
  if (!host.endsWith('.keynet')) {
    throw new Error('not a .keynet address');
  }

  const hostname = host.slice(0, -'.keynet'.length);

  return await decodeHostnamePubKey(hostname);
}
