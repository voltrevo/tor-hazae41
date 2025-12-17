import { test } from '../hazae41/phobos/mod';
import { assert } from '../utils/assert';
import { Base32 } from './Base32.js';
import { Bytes } from '../hazae41/bytes';

test('Base32.toString', async () => {
  // Test basic encoding
  const data = Bytes.from([0x8b, 0x1a, 0x9b, 0x5b, 0xcd]);
  const result = Base32.toString(data);
  assert(typeof result === 'string');
  assert(result.length > 0);
});

test('Base32.fromString', async () => {
  // Test basic decoding
  const encoded = Base32.toString(Bytes.from([0x8b, 0x1a, 0x9b, 0x5b, 0xcd]));
  const decoded = Base32.fromString(encoded);
  assert(decoded instanceof Uint8Array);
  assert(decoded.length === 5);
});

test('Base32 round-trip', async () => {
  // Test encoding and decoding with various data
  const testCases = [
    Bytes.from([0x00]),
    Bytes.from([0xff]),
    Bytes.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]), // "Hello"
    Bytes.from([0x8b, 0x1a, 0x9b, 0x5b, 0xcd, 0xef, 0x01, 0x23]),
  ];

  for (const originalData of testCases) {
    const encoded = Base32.toString(originalData);
    const decoded = Base32.fromString(encoded);

    assert(
      decoded.length === originalData.length,
      `Length mismatch: ${decoded.length} !== ${originalData.length}`
    );

    for (let i = 0; i < originalData.length; i++) {
      assert(
        decoded[i] === originalData[i],
        `Byte mismatch at index ${i}: ${decoded[i]} !== ${originalData[i]}`
      );
    }
  }
});

test('Base32 known values', async () => {
  // RFC 4648 test vectors
  const testVectors = [
    { decoded: Bytes.from([]), encoded: '' },
    { decoded: Bytes.from([0x66]), encoded: 'my' },
    { decoded: Bytes.from([0x66, 0x6f]), encoded: 'mzxq' },
    { decoded: Bytes.from([0x66, 0x6f, 0x6f]), encoded: 'mzxw6' },
    { decoded: Bytes.from([0x66, 0x6f, 0x6f, 0x62]), encoded: 'mzxw6yq' },
    {
      decoded: Bytes.from([0x66, 0x6f, 0x6f, 0x62, 0x61]),
      encoded: 'mzxw6ytb',
    },
    {
      decoded: Bytes.from([0x66, 0x6f, 0x6f, 0x62, 0x61, 0x72]),
      encoded: 'mzxw6ytboi',
    },
  ];

  for (const { decoded, encoded } of testVectors) {
    const result = Base32.toString(decoded);
    assert(result === encoded, `Encoding mismatch: ${result} !== ${encoded}`);

    if (encoded) {
      const roundTrip = Base32.fromString(encoded);
      assert(
        roundTrip.length === decoded.length,
        `Round-trip length mismatch: ${roundTrip.length} !== ${decoded.length}`
      );

      for (let i = 0; i < decoded.length; i++) {
        assert(
          roundTrip[i] === decoded[i],
          `Round-trip byte mismatch at index ${i}: ${roundTrip[i]} !== ${decoded[i]}`
        );
      }
    }
  }
});

test('Base32 case insensitivity', async () => {
  const encoded = 'MZXW6YTBOI';
  const decodedUpper = Base32.fromString(encoded);
  const decodedLower = Base32.fromString(encoded.toLowerCase());
  const decodedMixed = Base32.fromString('MzXw6YtBoI');

  for (let i = 0; i < decodedUpper.length; i++) {
    assert(decodedUpper[i] === decodedLower[i]);
    assert(decodedUpper[i] === decodedMixed[i]);
  }
});

test('Base32 invalid character', async () => {
  try {
    Base32.fromString('INVALID!@#');
    assert(false, 'Should have thrown an error');
  } catch (error) {
    assert(error instanceof Error);
    assert((error as Error).message.includes('Invalid Base32 character'));
  }
});
