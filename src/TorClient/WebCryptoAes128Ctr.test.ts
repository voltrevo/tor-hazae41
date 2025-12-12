import { assert } from '../utils/assert';
import { WebCryptoAes128Ctr } from './WebCryptoAes128Ctr';

async function testBasicKeystream() {
  // Test basic keystream generation
  const key = new Uint8Array(16).fill(0); // All zeros
  const counter = new Uint8Array(16).fill(0); // Start at 0
  const aes = new WebCryptoAes128Ctr(key, counter);

  const data = new Uint8Array(16).fill(0);
  await aes.apply_keystream(data);

  // Should have generated non-zero keystream
  const hasNonZero = Array.from(data).some(byte => byte !== 0);
  assert(hasNonZero, 'Keystream should be non-zero');
  console.log('✓ testBasicKeystream passed');
}

async function testCounterIncrement() {
  // Test that counter increments correctly
  const key = new Uint8Array(16).fill(0);

  // First test: same counter should produce same keystream
  const counter1a = new Uint8Array(16).fill(0);
  const aes1a = new WebCryptoAes128Ctr(key, counter1a);

  const counter1b = new Uint8Array(16).fill(0);
  const aes1b = new WebCryptoAes128Ctr(key, counter1b);

  const data1a = new Uint8Array(16).fill(0);
  const data1b = new Uint8Array(16).fill(0);

  await aes1a.apply_keystream(data1a);
  await aes1b.apply_keystream(data1b);

  assert(
    arraysEqual(data1a, data1b),
    'Same counter should produce same keystream'
  );

  // Second test: sequential blocks with one aes object should differ from first block
  const data2a = new Uint8Array(16).fill(0);
  await aes1a.apply_keystream(data2a);

  assert(
    !arraysEqual(data1a, data2a),
    'Sequential blocks with incremented counter should differ'
  );
  console.log('✓ testCounterIncrement passed');
}

async function testMultiBlockData() {
  // Test encryption of data longer than 16 bytes
  const key = new Uint8Array(16).fill(0x42);
  const counter = new Uint8Array(16).fill(0);
  const aes = new WebCryptoAes128Ctr(key, counter);

  const data = new Uint8Array(48).fill(0x55); // 3 blocks
  await aes.apply_keystream(data);

  // Should have modified all 48 bytes
  const allZero = data.every(byte => byte === 0x55);
  assert(!allZero, 'Multi-block data should be modified');
  console.log('✓ testMultiBlockData passed');
}

async function testXorIdempotence() {
  // Test that applying keystream twice returns to original
  const key = new Uint8Array(16).fill(0x11);
  const counter = new Uint8Array(16).fill(0);

  const original = new Uint8Array(32).fill(0xaa);
  const encrypted = new Uint8Array(original);

  const aes1 = new WebCryptoAes128Ctr(key, counter);
  await aes1.apply_keystream(encrypted);

  // Create new AES with same key and counter to encrypt again
  const counter2 = new Uint8Array(16).fill(0);
  const aes2 = new WebCryptoAes128Ctr(key, counter2);
  await aes2.apply_keystream(encrypted);

  // Should get back to original
  assert(
    arraysEqual(encrypted, original),
    'Double encryption should return to original'
  );
  console.log('✓ testXorIdempotence passed');
}

async function testDifferentCounterValues() {
  // Test that different counter values produce different keystreams
  const key = new Uint8Array(16).fill(0xcc);

  const counter1 = new Uint8Array(16).fill(0);
  const counter2 = new Uint8Array(16).fill(1);

  const aes1 = new WebCryptoAes128Ctr(key, counter1);
  const aes2 = new WebCryptoAes128Ctr(key, counter2);

  const data1 = new Uint8Array(16).fill(0);
  const data2 = new Uint8Array(16).fill(0);

  await aes1.apply_keystream(data1);
  await aes2.apply_keystream(data2);

  assert(
    !arraysEqual(data1, data2),
    'Different counters should produce different keystreams'
  );
  console.log('✓ testDifferentCounterValues passed');
}

async function testSmallData() {
  // Test with data smaller than 16 bytes
  const key = new Uint8Array(16).fill(0xdd);
  const counter = new Uint8Array(16).fill(0);
  const aes = new WebCryptoAes128Ctr(key, counter);

  const data = new Uint8Array(7).fill(0xee);
  const original = new Uint8Array(data);

  await aes.apply_keystream(data);

  assert(!arraysEqual(data, original), 'Small data should be encrypted');
  console.log('✓ testSmallData passed');
}

async function testLargeData() {
  // Test with data much larger than 16 bytes
  const key = new Uint8Array(16).fill(0xff);
  const counter = new Uint8Array(16).fill(0);
  const aes = new WebCryptoAes128Ctr(key, counter);

  const data = new Uint8Array(1024).fill(0x12);
  const original = new Uint8Array(data);

  await aes.apply_keystream(data);

  // Verify that most bytes were modified (at least 95% should be different)
  let changedCount = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== original[i]) changedCount++;
  }

  const changeRatio = changedCount / data.length;
  assert(
    changeRatio > 0.95,
    `Large data should be encrypted (${changeRatio * 100}% changed)`
  );
  console.log('✓ testLargeData passed');
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function runTests() {
  console.log('Running WebCryptoAes128Ctr tests...\n');
  await testBasicKeystream();
  await testCounterIncrement();
  await testMultiBlockData();
  await testXorIdempotence();
  await testDifferentCounterValues();
  await testSmallData();
  await testLargeData();
  console.log('\n✅ All tests passed!');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
