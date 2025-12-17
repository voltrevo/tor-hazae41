import { sha3 } from 'hash-wasm';
import { Base32 } from './Base32.js';
import { Bytes } from '../hazae41/bytes/index.js';

export async function decodeOnionStylePubKey(
  encodedKey: string
): Promise<Bytes> {
  // v3 addresses are exactly 56 base32 chars
  if (!/^[a-z2-7]{56}$/.test(encodedKey)) {
    throw new Error(
      'Invalid v3 tor pubkey onion-style format (expect 56 base32 chars).'
    );
  }

  // 2) Base32-decode → 35 bytes (32 pubkey | 2 checksum | 1 version)
  const decoded = Base32.fromString(encodedKey);
  if (decoded.length !== 35)
    throw new Error('Decoded length must be 35 bytes.');

  const pubkey = decoded.subarray(0, 32);
  const checksum = decoded.subarray(32, 34);
  const version = decoded[34];

  // 3) Version must be 0x03
  if (version !== 0x03)
    throw new Error(
      'Unsupported tor pubkey onion-style version (expected 0x03).'
    );

  // 4) Verify checksum = first 2 bytes of SHA3-256(".onion checksum" || pubkey || version)
  const prefix = new TextEncoder().encode('.onion checksum');
  const toHash = Bytes.alloc(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const digestHex = await sha3(toHash, 256);
  // Convert first 2 bytes of hex to Bytes for comparison
  const digest0 = parseInt(digestHex.substring(0, 2), 16);
  const digest1 = parseInt(digestHex.substring(2, 4), 16);
  if (digest0 !== checksum[0] || digest1 !== checksum[1]) {
    throw new Error('Checksum mismatch.');
  }

  return pubkey; // 32-byte Ed25519 public key
}
