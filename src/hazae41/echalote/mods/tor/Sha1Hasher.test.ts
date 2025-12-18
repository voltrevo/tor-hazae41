import { test } from '../../../phobos/mod';
import { assert } from '../../../../utils/assert';
import { Sha1Hasher } from './Sha1Hasher';
import { Bytes } from '../../../bytes';

// Helper function to convert Bytes to hex string
function toHex(bytes: Bytes): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Helper function to convert string to Bytes
function toBytes(str: string): Bytes {
  return Bytes.fromUtf8(str);
}

test('Sha1Hasher: basic single hash', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  hasher.updateOrThrow(toBytes('hello world'));
  const hash = hasher.finalizeOrThrow();

  const hex = toHex(hash);
  assert(
    hex === '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed',
    `Expected 2aae6c35c94fcfb415dbe95f408b9ce91ee846ed, got ${hex}`
  );
});

test('Sha1Hasher: empty input', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  hasher.updateOrThrow(toBytes(''));
  const hash = hasher.finalizeOrThrow();

  const hex = toHex(hash);
  assert(
    hex === 'da39a3ee5e6b4b0d3255bfef95601890afd80709',
    `Expected da39a3ee5e6b4b0d3255bfef95601890afd80709, got ${hex}`
  );
});

test('Sha1Hasher: incremental hashing', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  // Update with multiple chunks
  hasher.updateOrThrow(toBytes('hello'));
  hasher.updateOrThrow(toBytes(' '));
  hasher.updateOrThrow(toBytes('world'));

  const hash = hasher.finalizeOrThrow();

  const hex = toHex(hash);
  assert(
    hex === '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed',
    `Incremental hash should equal single update. Expected 2aae6c35c94fcfb415dbe95f408b9ce91ee846ed, got ${hex}`
  );
});

test('Sha1Hasher: long input', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  // Create 1000 'a' characters
  const longInput = 'a'.repeat(1000);
  hasher.updateOrThrow(toBytes(longInput));
  const hash = hasher.finalizeOrThrow();

  const hex = toHex(hash);
  assert(
    hex === '291e9a6c66994949b57ba5e650361e98fc36b1ba',
    `Expected 291e9a6c66994949b57ba5e650361e98fc36b1ba, got ${hex}`
  );
});

test('Sha1Hasher: pancake fox hash', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  hasher.updateOrThrow(toBytes('The quick brown fox jumps over the lazy dog'));
  const hash = hasher.finalizeOrThrow();

  const hex = toHex(hash);
  assert(
    hex === '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
    `Expected 2fd4e1c67a2d28fced849ee1bb76e7391b93eb12, got ${hex}`
  );
});

test('Sha1Hasher: cloneOrThrow does not modify original', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  // Update original
  hasher.updateOrThrow(toBytes('hello'));

  // Clone and update clone
  const cloned = await hasher.cloneOrThrow();

  cloned.updateOrThrow(toBytes(' world'));
  const clonedHash = cloned.finalizeOrThrow();
  const clonedHex = toHex(clonedHash);

  // Original should still be at 'hello' state
  hasher.updateOrThrow(toBytes(''));
  const originalHash = hasher.finalizeOrThrow();
  const originalHex = toHex(originalHash);

  // These should be different
  assert(
    clonedHex !== originalHex,
    'Cloned and original hashes should be different'
  );

  // Cloned should be 'hello world'
  assert(
    clonedHex === '2aae6c35c94fcfb415dbe95f408b9ce91ee846ed',
    `Cloned hash should be 'hello world'. Expected 2aae6c35c94fcfb415dbe95f408b9ce91ee846ed, got ${clonedHex}`
  );

  // Original should be just 'hello'
  assert(
    originalHex === 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
    `Original hash should be 'hello'. Expected aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d, got ${originalHex}`
  );
});

test('Sha1Hasher: output length is always 20 bytes', async () => {
  const testInputs = ['', 'a', 'hello world', 'a'.repeat(1000)];

  for (const input of testInputs) {
    const hasher = await Sha1Hasher.createOrThrow();

    hasher.updateOrThrow(toBytes(input));
    const hash = hasher.finalizeOrThrow();

    assert(
      hash.length === 20,
      `SHA1 hash should be 20 bytes, got ${hash.length}`
    );
  }
});

test('Sha1Hasher: binary data handling', async () => {
  const hasher = await Sha1Hasher.createOrThrow();

  // Create binary data with all byte values
  const binaryData = Bytes.from([0, 1, 2, 3, 255, 254, 253]);

  hasher.updateOrThrow(binaryData);
  const hash = hasher.finalizeOrThrow();

  // Verify it produces a valid hash
  assert(hash.length === 20, 'Should produce valid 20-byte hash');

  // Hash should be deterministic
  const hasher2 = await Sha1Hasher.createOrThrow();
  await hasher2.updateOrThrow(binaryData);
  const hash2 = await hasher2.finalizeOrThrow();

  const hex1 = toHex(hash);
  const hex2 = toHex(hash2);

  assert(
    hex1 === hex2,
    `Same input should produce same hash. Got ${hex1} and ${hex2}`
  );
});

test('Sha1Hasher: deterministic hashing', async () => {
  const input = toBytes('consistent input');

  // Hash the same input 5 times
  const hashes: string[] = [];

  for (let i = 0; i < 5; i++) {
    const hasher = await Sha1Hasher.createOrThrow();

    hasher.updateOrThrow(input);
    const hash = hasher.finalizeOrThrow();
    hashes.push(toHex(hash));
  }

  // All hashes should be identical
  const firstHash = hashes[0];
  for (let i = 1; i < hashes.length; i++) {
    assert(
      hashes[i] === firstHash,
      `Hash ${i} should match first hash. Got ${hashes[i]} vs ${firstHash}`
    );
  }
});

test('Sha1Hasher: allows update after finalize', async () => {
  // This test verifies the critical behavior for Tor circuit digest verification:
  // after finalize(), the hasher must still be usable for update().
  // This is required because Tor circuits compute digests and then continue
  // updating the same hasher with more data.
  // See: src/echalote/mods/tor/binary/cells/direct/relay/cell.ts:99-153

  const hasher = await Sha1Hasher.createOrThrow();

  // Initial update and finalize
  hasher.updateOrThrow(toBytes('hello'));
  const digest1 = hasher.finalizeOrThrow();
  const hex1 = toHex(digest1);

  // Critical: update after finalize must work (not throw "update() called before init()")
  hasher.updateOrThrow(toBytes('world'));
  const digest2 = hasher.finalizeOrThrow();
  const hex2 = toHex(digest2);

  // Verify both digests are correct
  assert(
    hex1 === 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
    'First digest should be hello'
  );
  assert(
    hex2 === '6adfb183a4a2c94a2f92dab5ade762a47889a5a1',
    `Second digest should be 'hello' + 'world'. Got ${hex2}`
  );
});
