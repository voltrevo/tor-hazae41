import { test } from '../hazae41/phobos/mod';
import { assert } from '../utils/assert';
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

  assert(
    consensusKeys.length === 2,
    `Should find 2 consensus keys, found ${consensusKeys.length}: ${JSON.stringify(consensusKeys)}`
  );
  assert(
    consensusKeys.includes('consensus:2025-12-03T05_00_00_000Z'),
    'Should include first consensus key'
  );
  assert(
    consensusKeys.includes('consensus:2025-12-03T06_00_00_000Z'),
    'Should include second consensus key'
  );

  // Should not include other keys
  assert(
    !consensusKeys.includes('other:key'),
    'Should not include non-consensus keys'
  );

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

  assert(
    allKeys.length === testKeys.length,
    `Should find ${testKeys.length} keys, found ${allKeys.length}`
  );

  for (const key of testKeys) {
    assert(allKeys.includes(key), `Should include key: ${key}`);
  }

  // Test reading back
  for (let i = 0; i < testKeys.length; i++) {
    const data = await storage.read(testKeys[i]);
    assert(data[0] === i, `Data for key ${testKeys[i]} should be [${i}]`);
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
    assert(allKeys.includes(key), `Should correctly unmangle: ${key}`);
  }

  // Test reading
  for (let i = 0; i < testKeys.length; i++) {
    const data = await storage.read(testKeys[i]);
    assert(data[0] === i, `Data for key ${testKeys[i]} should match`);
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

  assert(data.length === 3, 'Should read 3 bytes');
  assert(data[0] === 1 && data[1] === 2 && data[2] === 3, 'Data should match');
});

test('Memory Storage: list with prefix', async () => {
  const storage = new MemoryStorage();

  await storage.write('user/123', Bytes.from([4, 5]));
  await storage.write('user/456', Bytes.from([6, 7]));
  await storage.write('config/app', Bytes.from([8]));

  const userKeys = await storage.list('user/');
  assert(userKeys.length === 2, 'Should find 2 user keys');
  assert(userKeys.includes('user/123'), 'Should include user/123');
  assert(userKeys.includes('user/456'), 'Should include user/456');

  const allKeys = await storage.list('');
  assert(allKeys.length === 3, 'Should find all 3 keys');
});

test('Memory Storage: error on missing key', async () => {
  const storage = new MemoryStorage();

  try {
    await storage.read('nonexistent');
    assert(false, 'Should have thrown error for missing key');
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes('Key not found'),
      'Should throw key not found error'
    );
  }
});

test('Memory Storage: remove() deletes key', async () => {
  const storage = new MemoryStorage();

  await storage.write('a', Bytes.from([1]));
  await storage.write('b', Bytes.from([2]));
  await storage.write('c', Bytes.from([3]));

  await storage.remove('b');
  const keys = await storage.list('');

  assert(!keys.includes('b'), 'Key b should be removed');
  assert(keys.includes('a') && keys.includes('c'), 'Other keys should remain');
});

test('Memory Storage: removeAll(prefix) removes matching keys', async () => {
  const storage = new MemoryStorage();

  await storage.write('user/1', Bytes.from([4]));
  await storage.write('user/2', Bytes.from([5]));
  await storage.write('admin/1', Bytes.from([6]));

  await storage.removeAll('user/');
  const keys = await storage.list('');

  assert(
    !keys.includes('user/1') && !keys.includes('user/2'),
    'User keys should be removed'
  );
  assert(keys.includes('admin/1'), 'Admin key should remain');
});

test('Memory Storage: removeAll() removes all keys', async () => {
  const storage = new MemoryStorage();

  await storage.write('a', Bytes.from([1]));
  await storage.write('b', Bytes.from([2]));

  await storage.removeAll();
  const keys = await storage.list('');

  assert(keys.length === 0, 'All keys should be removed');
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

  assert(data.length === 1 && data[0] === 1, 'Data should match');

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
  assert(keys.length === 4, 'Should handle special characters');
  assert(keys.includes('with/slash'), 'Should include slash key');
  assert(keys.includes('with:colon'), 'Should include colon key');
  assert(keys.includes('with space'), 'Should include space key');
  assert(keys.includes('with@at'), 'Should include at key');

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
  assert(userKeys.length === 2, 'Should filter by prefix');
  assert(userKeys.includes('user/a'), 'Should include user/a');
  assert(userKeys.includes('user/b'), 'Should include user/b');

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
    assert(false, 'Should have thrown error for missing key');
  } catch (error) {
    assert(
      error instanceof Error && error.message.includes('Key not found'),
      'Should throw key not found error'
    );
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

  assert(!keys.includes('y'), 'File y should be removed');
  assert(keys.includes('x') && keys.includes('z'), 'Other files should remain');

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

  assert(
    !keys.includes('file/1') && !keys.includes('file/2'),
    'File keys should be removed'
  );
  assert(keys.includes('other/1'), 'Other key should remain');

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

  assert(keys.length === 0, 'All files should be removed');

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

  assert(data.length === 3 && data[0] === 1, 'Auto storage should work');

  const keys = await storage.list('key');
  assert(keys.length === 1 && keys[0] === 'key1', 'List should work');

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
    assert(keys.includes(key), `Key "${key}" should be in list`);
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
    assert(
      allKeys.includes(key),
      `Special key "${key}" should be preserved after mangling`
    );
  }

  rmSync(testDir, { recursive: true });
});
