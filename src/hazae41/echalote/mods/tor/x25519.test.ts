/**
 * X25519 Tests
 *
 * Tests for X25519 cryptographic operations using hardcoded test vectors
 * extracted from actual recordings. These tests verify that the X25519
 * library correctly computes shared secrets and handles key operations.
 */

import { test, expect } from 'vitest';
import { X25519 } from './x25519';
import { Bytes } from '../../../bytes';

function hexToUint8Array(hex: string): Bytes {
  const bytes = Bytes.alloc(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function uint8ArrayToHex(bytes: Bytes): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

test('X25519: PublicKey.import consistency', async () => {
  // Test vectors: known public keys that should round-trip correctly
  const publicKeyVectors = [
    'dee7289aa2a85152f93e138f1e3382fe8e38c8983f30bd2d815b8774f11be236',
    '96870eacfa7239a3a25cf5515608bf02765268d23d2e9ae785930e2f42d6b45c',
    '1e308414e533db01dcbe22a4b7ce2978a4a7651cf13359aba51076bc64f65e1e',
    'a2af5ab388a58780162f9557b6b88266cc67ffe4c976a2833ef8d56778442d10',
  ];

  for (let i = 0; i < publicKeyVectors.length; i++) {
    const inputKeyHex = publicKeyVectors[i];
    const inputKey = hexToUint8Array(inputKeyHex);

    // Import the public key
    const importedKey = await X25519.PublicKey.importOrThrow(inputKey);

    // Export it to verify it matches
    const exported = importedKey.exportOrThrow();
    const exportedHex = uint8ArrayToHex(exported.bytes as Bytes);

    expect(
      exportedHex === inputKeyHex,
      `PublicKey.import ${i}: exported key should match input`
    ).toBe(true);
  }
});

test('X25519: PrivateKey.compute with known test vectors', async () => {
  // Test vectors extracted from actual X25519 circuit extension operations
  // Each vector contains a private key, peer public key, and expected shared secret
  const testVectors = [
    {
      privateKeyHex:
        '5c300640df2c3e38891c378aa531422bc992d97e764a437c79ef43581c8a1e4d',
      publicKeyHex:
        '8a7a27f85496c285a08b702f5fec14bb2ca233daa0756bde185cff82a0e9372f',
      expectedSecretHex:
        '221c60540907fb234d19ab658ac28e491eaa0620d0002f1007961839cb262629',
    },
    {
      privateKeyHex:
        '5c300640df2c3e38891c378aa531422bc992d97e764a437c79ef43581c8a1e4d',
      publicKeyHex:
        'f63bc0a28c9e4d34965a67d46a4dd56df90f70d20baadf0f584588064f11e32b',
      expectedSecretHex:
        '5b1147276b1dca883acd439d4037cf0256969d94f7e3da1a88da596e3f647657',
    },
    {
      privateKeyHex:
        '891582121993c3630c535e94b92049054cbf91c4c74230f1601e789bb3f249db',
      publicKeyHex:
        '54ee7ab415b0f314d2d0635c33370360322c3e7d9db633f11f5a184fcb5aeb68',
      expectedSecretHex:
        'aa9ceddd551ff4fe086dec6da8f034ae3060d179c5fda70136978a1be3316957',
    },
    {
      privateKeyHex:
        '891582121993c3630c535e94b92049054cbf91c4c74230f1601e789bb3f249db',
      publicKeyHex:
        '40209c8c7393ff000bc1f0e173e76dd32451bbae77a769c491554a698d1f9862',
      expectedSecretHex:
        'f77c61d16bca12ab46e15e420bbd28f0f7efde3663e1b2778d84edb08b202c41',
    },
  ];

  for (let i = 0; i < testVectors.length; i++) {
    const vector = testVectors[i];

    // Import the private key from test vector
    const privateKey = await X25519.PrivateKey.importOrThrow(
      hexToUint8Array(vector.privateKeyHex)
    );

    // Import the peer's public key from test vector
    const publicKey = await X25519.PublicKey.importOrThrow(
      hexToUint8Array(vector.publicKeyHex)
    );

    // Compute shared secret with the recorded keys
    const sharedSecret = await privateKey.computeOrThrow(publicKey);
    const secretExported = sharedSecret.exportOrThrow();
    const secretHex = uint8ArrayToHex(secretExported.bytes as Bytes);

    // Verify the computed secret matches what was recorded
    expect(
      secretHex === vector.expectedSecretHex,
      `PrivateKey.compute ${i}: computed shared secret should match expected value (got ${secretHex})`
    ).toBe(true);
  }
});

test('X25519: PrivateKey.random generates valid keys', async () => {
  for (let i = 0; i < 3; i++) {
    // Generate a private key
    const privateKey = await X25519.PrivateKey.randomOrThrow();

    // Get its public key
    const publicKey = privateKey.getPublicKeyOrThrow();

    // Export the public key
    const exported = await publicKey.exportOrThrow();
    const publicKeyHex = uint8ArrayToHex(exported.bytes as Bytes);

    // Verify it's 32 bytes
    expect(publicKeyHex.length === 64).toBe(true);

    // Verify we can import it back
    const importedKey = await X25519.PublicKey.importOrThrow(
      exported.bytes as Bytes
    );

    const reimported = await importedKey.exportOrThrow();
    const reimportedHex = uint8ArrayToHex(reimported.bytes as Bytes);

    expect(
      reimportedHex === publicKeyHex,
      `Generated key ${i} should re-import identically`
    ).toBe(true);
  }
});

test('X25519: circuit extension sequence', async () => {
  // Simulate a circuit extension: generate ephemeral key, compute shared secrets with two peer keys
  const ephemeralPrivateKey = await X25519.PrivateKey.randomOrThrow();

  const ephemeralPublicKey = ephemeralPrivateKey.getPublicKeyOrThrow();

  const ephemeralPublicKeyExported = await ephemeralPublicKey.exportOrThrow();

  // Verify we got a valid public key
  const ephemeralKeyHex = uint8ArrayToHex(
    ephemeralPublicKeyExported.bytes as Bytes
  );

  expect(ephemeralKeyHex.length === 64).toBe(true);

  // Simulate getting relay public keys and computing shared secrets
  const relayPublicKeys = [
    '47c13d1fa3b1595fe37d8f875631fec3596fd88cc8497d29463156f403f77a21',
    '65d990975829be64934db6016bbfa62022de82577d6bab8ec590da9a9d7c6a1a',
  ];

  for (const relayKeyHex of relayPublicKeys) {
    const relayPublicKey = await X25519.PublicKey.importOrThrow(
      hexToUint8Array(relayKeyHex)
    );

    // Compute shared secret
    const sharedSecret =
      await ephemeralPrivateKey.computeOrThrow(relayPublicKey);

    const secretExported = sharedSecret.exportOrThrow();
    const secretHex = uint8ArrayToHex(secretExported.bytes as Bytes);

    // Verify we got a valid secret
    expect(secretHex.length === 64).toBe(true);
  }
});
