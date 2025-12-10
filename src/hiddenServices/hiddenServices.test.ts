import { test } from '@hazae41/phobos';
import { assert } from '../utils/assert';
import { never } from './never.js';
import { hash } from './hash.js';
import { decodeOnionPubKey } from './decodeOnionPubkey.js';
import { decodeOnionStylePubKey } from './decodeOnionStylePubkey.js';
import { Base32 } from './Base32.js';

test('never() throws with message', async () => {
  try {
    // Use a variable to bypass TypeScript's type narrowing
    const value: unknown = 'invalid';
    never(value as never);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Unexpected value'));
  }
});

test('hash() with string input', async () => {
  const result = await hash('hello');
  assert(result instanceof Uint8Array);
  assert(result.length === 32); // SHA3-256 produces 32 bytes
});

test('hash() with number input', async () => {
  const result = await hash(12345);
  assert(result instanceof Uint8Array);
  assert(result.length === 32);
});

test('hash() with Uint8Array input', async () => {
  const input = new Uint8Array([1, 2, 3, 4, 5]);
  const result = await hash(input);
  assert(result instanceof Uint8Array);
  assert(result.length === 32);
});

test('hash() with mixed inputs', async () => {
  const result = await hash('hello', 12345, new Uint8Array([1, 2, 3]));
  assert(result instanceof Uint8Array);
  assert(result.length === 32);
});

test('hash() with multiple strings', async () => {
  const result = await hash('hello', 'world');
  assert(result instanceof Uint8Array);
  assert(result.length === 32);
});

test('hash() with empty inputs', async () => {
  const result = await hash();
  assert(result instanceof Uint8Array);
  assert(result.length === 32);
});

test('hash() deterministic', async () => {
  const result1 = await hash('test');
  const result2 = await hash('test');

  assert(result1.length === result2.length);
  for (let i = 0; i < result1.length; i++) {
    assert(result1[i] === result2[i], `Hash mismatch at index ${i}`);
  }
});

test('decodeOnionPubkey() with valid .onion address', async () => {
  // Create a valid v3 .onion address
  // A v3 address is: 56 base32 chars (32 pubkey + 2 checksum + 1 version) + ".onion"
  const pubkey = new Uint8Array(32); // all zeros
  pubkey[0] = 1; // Make it non-zero to avoid trivial case

  // Calculate checksum
  const version = 0x03;
  const prefix = new TextEncoder().encode('.onion checksum');
  const toHash = new Uint8Array(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const { sha3 } = await import('hash-wasm');
  const digestHex = await sha3(toHash, 256);
  const digest0 = parseInt(digestHex.substring(0, 2), 16);
  const digest1 = parseInt(digestHex.substring(2, 4), 16);

  const checksumAndVersion = new Uint8Array([digest0, digest1, version]);
  const fullData = new Uint8Array(pubkey.length + checksumAndVersion.length);
  fullData.set(pubkey, 0);
  fullData.set(checksumAndVersion, pubkey.length);

  const hostname = Base32.toString(fullData);
  const result = await decodeOnionPubKey(hostname + '.onion');

  assert(result instanceof Uint8Array);
  assert(result.length === 32);
  for (let i = 0; i < 32; i++) {
    assert(result[i] === pubkey[i], `Pubkey mismatch at index ${i}`);
  }
});

test('decodeOnionPubkey() rejects non-.onion address', async () => {
  try {
    await decodeOnionPubKey('notvalid.com');
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('not a .onion address'));
  }
});

test('decodeOnionPubkey() with invalid hostname format', async () => {
  try {
    await decodeOnionPubKey('short.onion'); // Too short
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
  }
});

test('decodeOnionStylePubkey() with invalid format - wrong length', async () => {
  try {
    await decodeOnionStylePubKey('short');
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('56 base32 chars'));
  }
});

test('decodeOnionStylePubkey() with invalid format - invalid characters', async () => {
  try {
    // 56 chars but with invalid base32 chars
    const invalid = 'a'.repeat(55) + '!'; // '!' is not valid base32
    await decodeOnionStylePubKey(invalid);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
  }
});

test('decodeOnionStylePubkey() with invalid version', async () => {
  // Create valid 56 char base32 string with version != 0x03
  const pubkey = new Uint8Array(32);
  pubkey[0] = 1;

  const wrongVersion = 0x02; // Not 0x03
  const checksum = new Uint8Array([0, 0]); // Dummy checksum (will fail but version check is first)
  const versionByte = new Uint8Array([wrongVersion]);

  const fullData = new Uint8Array(pubkey.length + checksum.length + 1);
  fullData.set(pubkey, 0);
  fullData.set(checksum, pubkey.length);
  fullData.set(versionByte, pubkey.length + checksum.length);

  const hostname = Base32.toString(fullData);

  try {
    await decodeOnionStylePubKey(hostname);
    assert(false, 'should have thrown');
  } catch (error) {
    assert(error instanceof Error);
    assert(
      (error as Error).message.includes(
        'Unsupported tor pubkey onion-style version'
      )
    );
  }
});

test('decodeOnionStylePubkey() with correct checksum', async () => {
  // Create a completely valid v3 address
  const pubkey = new Uint8Array(32);
  pubkey[0] = 42;
  pubkey[1] = 99;

  const version = 0x03;
  const prefix = new TextEncoder().encode('.onion checksum');
  const toHash = new Uint8Array(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const { sha3 } = await import('hash-wasm');
  const digestHex = await sha3(toHash, 256);
  const digest0 = parseInt(digestHex.substring(0, 2), 16);
  const digest1 = parseInt(digestHex.substring(2, 4), 16);

  const checksumAndVersion = new Uint8Array([digest0, digest1, version]);
  const fullData = new Uint8Array(pubkey.length + checksumAndVersion.length);
  fullData.set(pubkey, 0);
  fullData.set(checksumAndVersion, pubkey.length);

  const hostname = Base32.toString(fullData);
  const result = await decodeOnionStylePubKey(hostname);

  assert(result instanceof Uint8Array);
  assert(result.length === 32);
  for (let i = 0; i < 32; i++) {
    assert(result[i] === pubkey[i], `Pubkey mismatch at index ${i}`);
  }
});
