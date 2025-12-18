import { test, expect } from 'vitest';
import { rmSync } from 'fs';
import { createAutoStorage, FsStorage, MemoryStorage } from './index.js';
import { Bytes } from '../hazae41/bytes';

// Mangle/Unmangle Tests (for FS storage internal functions)
test('FS Storage: list with colon prefix (consensus:)', async () => {
  const testDir = '/tmp/test-storage-mangle-colon';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  // Write keys with colons (like consensus:TIMESTAMP)
  await storage.write('consensus:2025-12-03T05_00_00_000Z', Bytes.from([1]));
  await storage.write('consensus:2025-12-03T06_00_00_000Z', Bytes.from([2]));
  await storage.write('other:key', Bytes.from([3]));

  // List should find keys starting with "consensus:"
  const consensusKeys = await storage.list('consensus:');

  expect(
    consensusKeys.length === 2,
    `Should find 2 consensus keys, found ${consensusKeys.length}: ${JSON.stringify(consensusKeys)}`
  ).toBe(true);
  expect(consensusKeys.includes('consensus:2025-12-03T05_00_00_000Z')).toBe(
    true
  );
  expect(consensusKeys.includes('consensus:2025-12-03T06_00_00_000Z')).toBe(
    true
  );

  // Should not include other keys
  expect(!consensusKeys.includes('other:key')).toBe(true);

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }
});

test('FS Storage: mangle/unmangle round-trip with special chars', async () => {
  const testDir = '/tmp/test-storage-mangle-roundtrip';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  const testKeys = [
    'simple',
    'with:colon',
    'with-dash',
    'with_underscore',
    'with/slash',
    'with.dot',
    'complex:key-with_many.special/chars',
    'consensus:2025-12-03T05_00_00_000Z',
  ];

  // Write all test keys
  for (let i = 0; i < testKeys.length; i++) {
    await storage.write(testKeys[i], Bytes.from([i]));
  }

  // List all keys and verify round-trip
  const allKeys = await storage.list('');

  expect(
    allKeys.length === testKeys.length,
    `Should find ${testKeys.length} keys, found ${allKeys.length}`
  ).toBe(true);

  for (const key of testKeys) {
    expect(allKeys.includes(key), `Should include key: ${key}`).toBe(true);
  }

  // Test reading back
  for (let i = 0; i < testKeys.length; i++) {
    const data = await storage.read(testKeys[i]);
    expect(data[0] === i, `Data for key ${testKeys[i]} should be [${i}]`).toBe(
      true
    );
  }

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }
});

test('FS Storage: unmangle handles consecutive hex-like sequences', async () => {
  const testDir = '/tmp/test-storage-mangle-consecutive';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  // These keys have special chars that when mangled, create consecutive _XX patterns
  // E.g., "a:-" becomes "a_3a_2d"
  const testKeys = [
    'a:-', // _3a_2d - colon then dash
    'a:--', // _3a_2d_2d - colon then two dashes
    'test:2025', // _3a followed by digits
  ];

  for (let i = 0; i < testKeys.length; i++) {
    await storage.write(testKeys[i], Bytes.from([i]));
  }

  const allKeys = await storage.list('');

  for (const key of testKeys) {
    expect(allKeys.includes(key), `Should correctly unmangle: ${key}`).toBe(
      true
    );
  }

  // Test reading
  for (let i = 0; i < testKeys.length; i++) {
    const data = await storage.read(testKeys[i]);
    expect(data[0] === i, `Data for key ${testKeys[i]} should match`).toBe(
      true
    );
  }

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }
});

// Memory Storage Tests
test('Memory Storage: write and read', async () => {
  const storage = new MemoryStorage();

  await storage.write('test1', Bytes.from([1, 2, 3]));
  const data = await storage.read('test1');

  expect(data.length === 3).toBe(true);
  expect(data[0] === 1 && data[1] === 2 && data[2] === 3).toBe(true);
});

test('Memory Storage: list with prefix', async () => {
  const storage = new MemoryStorage();

  await storage.write('user/123', Bytes.from([4, 5]));
  await storage.write('user/456', Bytes.from([6, 7]));
  await storage.write('config/app', Bytes.from([8]));

  const userKeys = await storage.list('user/');
  expect(userKeys.length === 2).toBe(true);
  expect(userKeys.includes('user/123')).toBe(true);
  expect(userKeys.includes('user/456')).toBe(true);

  const allKeys = await storage.list('');
  expect(allKeys.length === 3).toBe(true);
});

test('Memory Storage: error on missing key', async () => {
  const storage = new MemoryStorage();

  try {
    await storage.read('nonexistent');
    expect(false).toBe(true);
  } catch (error) {
    expect(
      error instanceof Error && error.message.includes('Key not found')
    ).toBe(true);
  }
});

test('Memory Storage: remove() deletes key', async () => {
  const storage = new MemoryStorage();

  await storage.write('a', Bytes.from([1]));
  await storage.write('b', Bytes.from([2]));
  await storage.write('c', Bytes.from([3]));

  await storage.remove('b');
  const keys = await storage.list('');

  expect(!keys.includes('b')).toBe(true);
  expect(keys.includes('a') && keys.includes('c')).toBe(true);
});

test('Memory Storage: removeAll(prefix) removes matching keys', async () => {
  const storage = new MemoryStorage();

  await storage.write('user/1', Bytes.from([4]));
  await storage.write('user/2', Bytes.from([5]));
  await storage.write('admin/1', Bytes.from([6]));

  await storage.removeAll('user/');
  const keys = await storage.list('');

  expect(!keys.includes('user/1') && !keys.includes('user/2')).toBe(true);
  expect(keys.includes('admin/1')).toBe(true);
});

test('Memory Storage: removeAll() removes all keys', async () => {
  const storage = new MemoryStorage();

  await storage.write('a', Bytes.from([1]));
  await storage.write('b', Bytes.from([2]));

  await storage.removeAll();
  const keys = await storage.list('');

  expect(keys.length === 0).toBe(true);
});

// File System Storage Tests
test('FS Storage: write and read', async () => {
  const testDir = '/tmp/test-storage-fs-basic';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('simple', Bytes.from([1]));
  const data = await storage.read('simple');

  expect(data.length === 1 && data[0] === 1).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: special characters in keys', async () => {
  const testDir = '/tmp/test-storage-fs-special';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('with/slash', Bytes.from([2]));
  await storage.write('with:colon', Bytes.from([3]));
  await storage.write('with space', Bytes.from([4]));
  await storage.write('with@at', Bytes.from([5]));

  const keys = await storage.list('with');
  expect(keys.length === 4).toBe(true);
  expect(keys.includes('with/slash')).toBe(true);
  expect(keys.includes('with:colon')).toBe(true);
  expect(keys.includes('with space')).toBe(true);
  expect(keys.includes('with@at')).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: list with prefix', async () => {
  const testDir = '/tmp/test-storage-fs-prefix';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('user/a', Bytes.from([6]));
  await storage.write('user/b', Bytes.from([7]));
  await storage.write('admin/x', Bytes.from([8]));

  const userKeys = await storage.list('user/');
  expect(userKeys.length === 2).toBe(true);
  expect(userKeys.includes('user/a')).toBe(true);
  expect(userKeys.includes('user/b')).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: error on missing key', async () => {
  const testDir = '/tmp/test-storage-fs-missing';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  try {
    await storage.read('nonexistent');
    expect(false).toBe(true);
  } catch (error) {
    expect(
      error instanceof Error && error.message.includes('Key not found')
    ).toBe(true);
  }

  rmSync(testDir, { recursive: true });
});

test('FS Storage: remove() deletes file', async () => {
  const testDir = '/tmp/test-storage-fs-remove';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('x', Bytes.from([1]));
  await storage.write('y', Bytes.from([2]));
  await storage.write('z', Bytes.from([3]));

  await storage.remove('y');
  const keys = await storage.list('');

  expect(!keys.includes('y')).toBe(true);
  expect(keys.includes('x') && keys.includes('z')).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: removeAll(prefix) removes matching files', async () => {
  const testDir = '/tmp/test-storage-fs-removeall-prefix';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('file/1', Bytes.from([4]));
  await storage.write('file/2', Bytes.from([5]));
  await storage.write('other/1', Bytes.from([6]));

  await storage.removeAll('file/');
  const keys = await storage.list('');

  expect(!keys.includes('file/1') && !keys.includes('file/2')).toBe(true);
  expect(keys.includes('other/1')).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: removeAll() removes all files', async () => {
  const testDir = '/tmp/test-storage-fs-removeall';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.write('a', Bytes.from([1]));
  await storage.write('b', Bytes.from([2]));

  await storage.removeAll();
  const keys = await storage.list('');

  expect(keys.length === 0).toBe(true);

  rmSync(testDir, { recursive: true });
});

test('FS Storage: remove() on non-existent key succeeds silently', async () => {
  const testDir = '/tmp/test-storage-fs-remove-nonexist';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.remove('nonexistent');

  rmSync(testDir, { recursive: true });
});

test('FS Storage: removeAll() on empty directory succeeds', async () => {
  const testDir = '/tmp/test-storage-fs-removeall-empty';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  await storage.removeAll();

  rmSync(testDir, { recursive: true });
});

// Auto Storage Tests
test('Auto Storage: basic operations', async () => {
  const testDir = '/tmp/test-auto-storage';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = createAutoStorage('test-auto-storage');

  await storage.write('key1', Bytes.from([1, 2, 3]));
  const data = await storage.read('key1');

  expect(data.length === 3 && data[0] === 1).toBe(true);

  const keys = await storage.list('key');
  expect(keys.length === 1 && keys[0] === 'key1').toBe(true);

  rmSync(testDir, { recursive: true });
});

// Key Mangling Tests
test('Key Mangling: alphanumeric keys unchanged', async () => {
  const testDir = '/tmp/test-mangling-alphanum';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  const alphanumericKeys = ['abc', 'ABC', '123', 'aBc123', 'testKey'];

  for (const key of alphanumericKeys) {
    await storage.write(key, Bytes.from([1]));
  }

  const keys = await storage.list('');

  for (const key of alphanumericKeys) {
    expect(keys.includes(key), `Key "${key}" should be in list`).toBe(true);
  }

  rmSync(testDir, { recursive: true });
});

test('Key Mangling: special keys preserved', async () => {
  const testDir = '/tmp/test-mangling-special';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const storage = new FsStorage(testDir);

  const specialKeys = [
    'with/slash',
    'with:colon',
    'with space',
    'with@at',
    'with[brackets]',
    'with{braces}',
  ];

  for (const key of specialKeys) {
    await storage.write(key, Bytes.from([1]));
  }

  const allKeys = await storage.list('');

  for (const key of specialKeys) {
    expect(
      allKeys.includes(key),
      `Special key "${key}" should be preserved after mangling`
    ).toBe(true);
  }

  rmSync(testDir, { recursive: true });
});
