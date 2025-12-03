/**
 * Comprehensive test suite for the storage module
 * Run with: node --input-type=module test-storage.mjs
 */

import {
  createMemoryStorage,
  createFsStorage,
  createAutoStorage,
} from './dist/storage/index-node.mjs';
import { rmSync } from 'fs';

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`
    );
  }
}

async function testMemoryStorage() {
  console.log('Testing Memory Storage...');

  const storage = createMemoryStorage();

  // Test write and read
  await storage.write('test1', new Uint8Array([1, 2, 3]));
  const data = await storage.read('test1');
  assertEquals(Array.from(data), [1, 2, 3], 'Read should return written data');

  // Test multiple keys
  await storage.write('user/123', new Uint8Array([4, 5]));
  await storage.write('user/456', new Uint8Array([6, 7]));
  await storage.write('config/app', new Uint8Array([8]));

  // Test list with prefix
  const userKeys = await storage.list('user/');
  assertEquals(
    userKeys,
    ['user/123', 'user/456'],
    'List should filter by prefix'
  );

  const allKeys = await storage.list('');
  assertEquals(
    allKeys.sort(),
    ['config/app', 'test1', 'user/123', 'user/456'],
    'List all keys'
  );

  // Test error on missing key
  try {
    await storage.read('nonexistent');
    throw new Error('Should have thrown error for missing key');
  } catch (error) {
    if (!error.message.includes('Key not found')) {
      throw error;
    }
  }

  console.log('✓ Memory Storage tests passed\n');
}

async function testFsStorage() {
  console.log('Testing File System Storage...');

  const testDir = '/tmp/test-storage-fs';

  // Clean up
  try {
    rmSync(testDir, { recursive: true });
  } catch {}

  const storage = createFsStorage(testDir);

  // Test basic operations
  await storage.write('simple', new Uint8Array([1]));
  const data = await storage.read('simple');
  assertEquals(Array.from(data), [1], 'Read should return written data');

  // Test special characters in keys
  await storage.write('with/slash', new Uint8Array([2]));
  await storage.write('with:colon', new Uint8Array([3]));
  await storage.write('with space', new Uint8Array([4]));
  await storage.write('with@at', new Uint8Array([5]));

  const keys = await storage.list('with');
  assertEquals(
    keys.sort(),
    ['with space', 'with/slash', 'with:colon', 'with@at'].sort(),
    'Should handle special characters'
  );

  // Test list with prefix
  await storage.write('user/a', new Uint8Array([6]));
  await storage.write('user/b', new Uint8Array([7]));
  await storage.write('admin/x', new Uint8Array([8]));

  const userKeys = await storage.list('user/');
  assertEquals(userKeys, ['user/a', 'user/b'], 'Should filter by prefix');

  // Test error on missing key
  try {
    await storage.read('nonexistent');
    throw new Error('Should have thrown error for missing key');
  } catch (error) {
    if (!error.message.includes('Key not found')) {
      throw error;
    }
  }

  // Clean up
  rmSync(testDir, { recursive: true });

  console.log('✓ File System Storage tests passed\n');
}

async function testAutoStorage() {
  console.log('Testing Auto Storage...');

  const testDir = '/tmp/test-auto-storage';

  // Clean up
  try {
    rmSync(testDir, { recursive: true });
  } catch {}

  const storage = createAutoStorage('test-auto-storage');

  // Test basic operations
  await storage.write('key1', new Uint8Array([1, 2, 3]));
  const data = await storage.read('key1');
  assertEquals(Array.from(data), [1, 2, 3], 'Auto storage should work');

  const keys = await storage.list('key');
  assertEquals(keys, ['key1'], 'List should work with auto storage');

  // Clean up
  rmSync(testDir, { recursive: true });

  console.log('✓ Auto Storage tests passed\n');
}

async function testKeyMangling() {
  console.log('Testing Key Mangling...');

  const testDir = '/tmp/test-mangling';

  // Clean up
  try {
    rmSync(testDir, { recursive: true });
  } catch {}

  const storage = createFsStorage(testDir);

  // Test that alphanumeric characters pass through unchanged
  const alphanumericKeys = ['abc', 'ABC', '123', 'aBc123', 'testKey'];

  for (const key of alphanumericKeys) {
    await storage.write(key, new Uint8Array([1]));
  }

  const keys = await storage.list('');
  for (const key of alphanumericKeys) {
    if (!keys.includes(key)) {
      throw new Error(`Key "${key}" not found in list`);
    }
  }

  // Test bidirectional mapping
  const specialKeys = [
    'with/slash',
    'with:colon',
    'with space',
    'with@at',
    'with[brackets]',
    'with{braces}',
  ];

  for (const key of specialKeys) {
    await storage.write(key, new Uint8Array([1]));
  }

  const allKeys = await storage.list('');
  for (const key of specialKeys) {
    if (!allKeys.includes(key)) {
      throw new Error(`Special key "${key}" not preserved after mangling`);
    }
  }

  // Clean up
  rmSync(testDir, { recursive: true });

  console.log('✓ Key Mangling tests passed\n');
}

async function runAllTests() {
  console.log('=== Storage Module Test Suite ===\n');

  try {
    await testMemoryStorage();
    await testFsStorage();
    await testAutoStorage();
    await testKeyMangling();

    console.log('=== ✅ All tests passed! ===');
  } catch (error) {
    console.error('=== ❌ Test failed ===');
    console.error(error);
    process.exit(1);
  }
}

runAllTests();
