import { test, expect } from 'vitest';
import { never } from './never.js';
import { hash } from './hash.js';
import { decodeOnionPubKey } from './decodeOnionPubkey.js';
import { decodeOnionStylePubKey } from './decodeOnionStylePubkey.js';
import { Base32 } from './Base32.js';
import { Bytes } from '../hazae41/bytes';

test('never() throws with message', async () => {
  try {
    // Use a variable to bypass TypeScript's type narrowing
    const value: unknown = 'invalid';
    never(value as never);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    assert((error as Error).message.includes('Unexpected value'));
  }
});

test('hash() with string input', async () => {
  const result = await hash('hello');
  expect(result instanceof Uint8Array).toBe(true);
  assert(result.length === 32); // SHA3-256 produces 32 bytes
});

test('hash() with number input', async () => {
  const result = await hash(12345);
  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
});

test('hash() with Bytes input', async () => {
  const input = Bytes.from([1, 2, 3, 4, 5]);
  const result = await hash(input);
  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
});

test('hash() with mixed inputs', async () => {
  const result = await hash('hello', 12345, Bytes.from([1, 2, 3]));
  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
});

test('hash() with multiple strings', async () => {
  const result = await hash('hello', 'world');
  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
});

test('hash() with empty inputs', async () => {
  const result = await hash();
  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
});

test('hash() deterministic', async () => {
  const result1 = await hash('test');
  const result2 = await hash('test');

  expect(result1.length === result2.length).toBe(true);
  for (let i = 0; i < result1.length; i++) {
    expect(result1[i] === result2[i], `Hash mismatch at index ${i}`).toBe(true);
  }
});

test('decodeOnionPubkey() with valid .onion address', async () => {
  // Create a valid v3 .onion address
  // A v3 address is: 56 base32 chars (32 pubkey + 2 checksum + 1 version) + ".onion"
  const pubkey = Bytes.alloc(32); // all zeros
  pubkey[0] = 1; // Make it non-zero to avoid trivial case

  // Calculate checksum
  const version = 0x03;
  const prefix = Bytes.encodeUtf8('.onion checksum');
  const toHash = Bytes.alloc(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const { sha3 } = await import('hash-wasm');
  const digestHex = await sha3(toHash, 256);
  const digest0 = parseInt(digestHex.substring(0, 2), 16);
  const digest1 = parseInt(digestHex.substring(2, 4), 16);

  const checksumAndVersion = Bytes.from([digest0, digest1, version]);
  const fullData = Bytes.alloc(pubkey.length + checksumAndVersion.length);
  fullData.set(pubkey, 0);
  fullData.set(checksumAndVersion, pubkey.length);

  const hostname = Base32.toString(fullData);
  const result = await decodeOnionPubKey(hostname + '.onion');

  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
  for (let i = 0; i < 32; i++) {
    expect(result[i] === pubkey[i], `Pubkey mismatch at index ${i}`).toBe(true);
  }
});

test('decodeOnionPubkey() rejects non-.onion address', async () => {
  try {
    await decodeOnionPubKey('notvalid.com');
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    assert((error as Error).message.includes('not a .onion address'));
  }
});

test('decodeOnionPubkey() with invalid hostname format', async () => {
  try {
    await decodeOnionPubKey('short.onion'); // Too short
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
  }
});

test('decodeOnionStylePubkey() with invalid format - wrong length', async () => {
  try {
    await decodeOnionStylePubKey('short');
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    assert((error as Error).message.includes('56 base32 chars'));
  }
});

test('decodeOnionStylePubkey() with invalid format - invalid characters', async () => {
  try {
    // 56 chars but with invalid base32 chars
    const invalid = 'a'.repeat(55) + '!'; // '!' is not valid base32
    await decodeOnionStylePubKey(invalid);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
  }
});

test('decodeOnionStylePubkey() with invalid version', async () => {
  // Create valid 56 char base32 string with version != 0x03
  const pubkey = Bytes.alloc(32);
  pubkey[0] = 1;

  const wrongVersion = 0x02; // Not 0x03
  const checksum = Bytes.from([0, 0]); // Dummy checksum (will fail but version check is first)
  const versionByte = Bytes.from([wrongVersion]);

  const fullData = Bytes.alloc(pubkey.length + checksum.length + 1);
  fullData.set(pubkey, 0);
  fullData.set(checksum, pubkey.length);
  fullData.set(versionByte, pubkey.length + checksum.length);

  const hostname = Base32.toString(fullData);

  try {
    await decodeOnionStylePubKey(hostname);
    expect(false).toBe(true);
  } catch (error) {
    expect(error instanceof Error).toBe(true);
    assert(
      (error as Error).message.includes(
        'Unsupported tor pubkey onion-style version'
      )
    );
  }
});

test('decodeOnionStylePubkey() with correct checksum', async () => {
  // Create a completely valid v3 address
  const pubkey = Bytes.alloc(32);
  pubkey[0] = 42;
  pubkey[1] = 99;

  const version = 0x03;
  const prefix = Bytes.encodeUtf8('.onion checksum');
  const toHash = Bytes.alloc(prefix.length + 32 + 1);
  toHash.set(prefix, 0);
  toHash.set(pubkey, prefix.length);
  toHash[prefix.length + 32] = version;

  const { sha3 } = await import('hash-wasm');
  const digestHex = await sha3(toHash, 256);
  const digest0 = parseInt(digestHex.substring(0, 2), 16);
  const digest1 = parseInt(digestHex.substring(2, 4), 16);

  const checksumAndVersion = Bytes.from([digest0, digest1, version]);
  const fullData = Bytes.alloc(pubkey.length + checksumAndVersion.length);
  fullData.set(pubkey, 0);
  fullData.set(checksumAndVersion, pubkey.length);

  const hostname = Base32.toString(fullData);
  const result = await decodeOnionStylePubKey(hostname);

  expect(result instanceof Uint8Array).toBe(true);
  expect(result.length === 32).toBe(true);
  for (let i = 0; i < 32; i++) {
    expect(result[i] === pubkey[i], `Pubkey mismatch at index ${i}`).toBe(true);
  }
});
