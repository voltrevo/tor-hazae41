import { decodeOnionStylePubKey } from '../hiddenServices/decodeOnionStylePubkey.js';

export async function decodeKeynetPubKey(host: string): Promise<Uint8Array> {
  if (!host.endsWith('.keynet')) {
    throw new Error('not a .keynet address');
  }

  const encodedKey = host.slice(0, -'.keynet'.length);

  return await decodeOnionStylePubKey(encodedKey);
}
