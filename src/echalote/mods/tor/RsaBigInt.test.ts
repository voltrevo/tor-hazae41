/**
 * Test file for RSA BigInt implementation
 * Tests cryptographic signature verification against 15 real Tor network vectors
 */

import { test } from '@hazae41/phobos';
import { RsaBigInt } from './RsaBigInt.js';
import { assert } from '../../../utils/assert.js';
import testVectors from './rsa-test-vectors.json' assert { type: 'json' };
import { Bytes } from '../../../hazae41/bytes/index.js';

// No WASM initialization needed

test('RSA BigInt: Memory wrapper interface is compatible', async () => {
  const testBytes = Bytes.from([0x01, 0x02, 0x03, 0x04]);

  const bigIntMem = new RsaBigInt.Memory(testBytes);

  // Check interface
  assert(
    bigIntMem.len() === testBytes.length,
    'BigInt Memory.len() should match'
  );

  assert(
    [...bigIntMem.bytes].every((b, i) => b === testBytes[i]),
    'BigInt Memory.bytes should match input'
  );
});

test('RSA BigInt: Memory initializes from ArrayBuffer', async () => {
  const buffer = new ArrayBuffer(8);
  const view = Bytes.from(buffer);
  view[0] = 42;

  const memory = new RsaBigInt.Memory(buffer);
  assert(memory.bytes[0] === 42, 'ArrayBuffer initialization should work');
  assert(memory.len() === 8, 'ArrayBuffer len() should return 8');
});

test('RSA BigInt: RsaPublicKey interface exists', async () => {
  assert(RsaBigInt.RsaPublicKey !== undefined, 'RsaPublicKey should exist');
  assert(
    RsaBigInt.RsaPublicKey.from_public_key_der !== undefined,
    'from_public_key_der method should exist'
  );
  assert(
    RsaBigInt.RsaPublicKey.from_pkcs1_der !== undefined,
    'from_pkcs1_der method should exist'
  );
});

test('RSA BigInt: handles invalid DER gracefully', async () => {
  const invalidDER = Bytes.from([0xff, 0xff, 0xff]); // Invalid DER
  const memory = new RsaBigInt.Memory(invalidDER);

  try {
    RsaBigInt.RsaPublicKey.from_public_key_der(memory);
    throw new Error('Should have thrown on invalid DER');
  } catch (e) {
    assert(
      e instanceof Error && e.message.includes('Failed to parse'),
      'Should throw parse error on invalid DER'
    );
  }
});

test('RSA BigInt: Test vector from real Tor certificate (captured from integration test)', async () => {
  /**
   * Test vectors captured during real Tor network integration tests
   * - 1 directory certificate (1024-bit RSA, SHA-256)
   * - 7 consensus documents (3072-bit RSA, SHA-1)
   * - 7 more consensus documents (2048-bit RSA, SHA-256)
   *
   * All vectors verified by WASM implementation (ground truth) and matched by BigInt implementation
   * Total: 15 real-world Tor network signatures
   */

  // Test all vectors
  for (let vectorIdx = 0; vectorIdx < testVectors.length; vectorIdx++) {
    const { publicKeyDerHex, hashHex, signatureHex } = testVectors[vectorIdx];

    // Convert hex strings to Bytes
    const publicKeyDer = Bytes.from(
      publicKeyDerHex
        .match(/.{1,2}/g)!
        .map((byte: string) => parseInt(byte, 16))
    );
    const testHash = Bytes.from(
      hashHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );
    const testSignature = Bytes.from(
      signatureHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
    );

    // Verify test vector format
    assert(
      publicKeyDer.length > 0,
      `Vector ${vectorIdx}: Public key DER should be non-empty`
    );
    assert(
      testHash.length === 32 || testHash.length === 20,
      `Vector ${vectorIdx}: Hash should be 32 bytes (SHA-256) or 20 bytes (SHA-1)`
    );
    assert(
      testSignature.length === 128 ||
        testSignature.length === 256 ||
        testSignature.length === 384,
      `Vector ${vectorIdx}: Signature should be 128 bytes (1024-bit RSA), 256 bytes (2048-bit RSA), or 384 bytes (3072-bit RSA)`
    );

    // Parse the public key
    const publicKeyMemory = new RsaBigInt.Memory(publicKeyDer);
    const publicKey =
      RsaBigInt.RsaPublicKey.from_public_key_der(publicKeyMemory);

    assert(
      publicKey !== null,
      `Vector ${vectorIdx}: Public key should parse successfully from DER`
    );

    // Verify the signature using BigInt implementation
    const hashMemory = new RsaBigInt.Memory(testHash);
    const signatureMemory = new RsaBigInt.Memory(testSignature);
    const verified = publicKey.verify_pkcs1v15_unprefixed(
      hashMemory,
      signatureMemory
    );

    assert(
      verified === true,
      `Vector ${vectorIdx}: BigInt RSA verification should succeed with real test vector`
    );

    // Test corruption: flip bits in hash at various positions
    // Use positions appropriate for hash size (20 or 32 bytes)
    const hashLen = testHash.length;
    const hashCorruptionPositions = [0, Math.floor(hashLen / 2), hashLen - 1];
    for (const pos of hashCorruptionPositions) {
      const corruptedHash = Bytes.from(testHash);
      corruptedHash[pos] ^= 0xff; // Flip all bits

      const corruptedHashMemory = new RsaBigInt.Memory(corruptedHash);
      const corruptedVerified = publicKey!.verify_pkcs1v15_unprefixed(
        corruptedHashMemory,
        signatureMemory
      );

      assert(
        corruptedVerified === false,
        `Vector ${vectorIdx}: Corruption at hash byte ${pos} should fail verification`
      );
    }

    // Test corruption: flip bits in signature at various positions
    // Use positions appropriate for signature size (128, 256, or 384 bytes)
    const sigLen = testSignature.length;
    const sigCorruptionPositions = [0, Math.floor(sigLen / 2), sigLen - 1];
    for (const pos of sigCorruptionPositions) {
      const corruptedSignature = Bytes.from(testSignature);
      corruptedSignature[pos] ^= 0xff; // Flip all bits

      const corruptedSignatureMemory = new RsaBigInt.Memory(corruptedSignature);
      const corruptedVerified = publicKey!.verify_pkcs1v15_unprefixed(
        hashMemory,
        corruptedSignatureMemory
      );

      assert(
        corruptedVerified === false,
        `Vector ${vectorIdx}: Corruption at signature byte ${pos} should fail verification`
      );
    }

    // Test corruption: flip single bit at various positions
    const singleBitPositions = [0, Math.floor(sigLen / 2), sigLen - 1];
    for (const pos of singleBitPositions) {
      const corruptedSignature = Bytes.from(testSignature);
      corruptedSignature[pos] ^= 0x01; // Flip single bit

      const corruptedSignatureMemory = new RsaBigInt.Memory(corruptedSignature);
      const corruptedVerified = publicKey!.verify_pkcs1v15_unprefixed(
        hashMemory,
        corruptedSignatureMemory
      );

      assert(
        corruptedVerified === false,
        `Vector ${vectorIdx}: Single bit corruption at signature byte ${pos} should fail verification`
      );
    }
  }
});
