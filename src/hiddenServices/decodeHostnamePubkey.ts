import { sha3_256 } from '@noble/hashes/sha3.js';
import { Base32 } from './Base32.js';

export function decodeHostnamePubKey(hostname: string): Uint8Array {
  // v3 addresses are exactly 56 base32 chars
  if (!/^[a-z2-7]{56}$/.test(hostname)) {
    throw new Error(
      'Invalid v3 tor pubkey hostname format (expect 56 base32 chars).'
    );
  }

  // 2) Base32-decode → 35 bytes (32 pubkey | 2 checksum | 1 version)
  const decoded = Base32.fromString(hostname);
  if (decoded.length !== 35)
    throw new Error('Decoded length must be 35 bytes.');

  const pubkey = decoded.subarray(0, 32);
  const checksum = decoded.subarray(32, 34);
  const version = decoded[34];

  // 3) Version must be 0x03
  if (version !== 0x03)
    throw new Error('Unsupported tor pubkey hostname version (expected 0x03).');

  // 4) Verify checksum = first 2 bytes of SHA3-256(".onion checksum" || pubkey || version)
  const prefix = new TextEncoder().encode('.onion checksum');
  const toHash = new Uint8Array(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const digest = sha3_256(toHash);
  if (digest.length < 2)
    throw new Error('Hash function returned too few bytes.');
  if (digest[0] !== checksum[0] || digest[1] !== checksum[1]) {
    throw new Error('Checksum mismatch.');
  }

  return pubkey; // 32-byte Ed25519 public key
}
