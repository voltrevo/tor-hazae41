import {
  createMemoryStorage,
  createFsStorage,
} from './dist/storage/index-node.mjs';
import { rmSync } from 'fs';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log('✓', name);
    passed++;
  } catch (error) {
    console.log('✗', name);
    console.log('  Error:', error.message);
    failed++;
  }
}

async function runTests() {
  // Memory storage tests
  const memory = createMemoryStorage();

  await memory.write('a', new Uint8Array([1]));
  await memory.write('b', new Uint8Array([2]));
  await memory.write('c', new Uint8Array([3]));

  await test('Memory: remove() deletes key', async () => {
    await memory.remove('b');
    const keys = await memory.list('');
    if (keys.includes('b')) throw new Error('Key b still exists');
    if (!keys.includes('a') || !keys.includes('c'))
      throw new Error('Other keys missing');
  });

  await memory.write('user/1', new Uint8Array([4]));
  await memory.write('user/2', new Uint8Array([5]));
  await memory.write('admin/1', new Uint8Array([6]));

  await test('Memory: removeAll(prefix) removes matching keys', async () => {
    await memory.removeAll('user/');
    const keys = await memory.list('');
    if (keys.includes('user/1') || keys.includes('user/2')) {
      throw new Error('User keys still exist');
    }
    if (!keys.includes('admin/1')) throw new Error('Admin key missing');
  });

  await test('Memory: removeAll() removes all keys', async () => {
    await memory.removeAll();
    const keys = await memory.list('');
    if (keys.length !== 0) throw new Error('Keys still exist');
  });

  // FS storage tests
  const testDir = '/tmp/test-storage-remove';
  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const fs = createFsStorage(testDir);

  await fs.write('x', new Uint8Array([1]));
  await fs.write('y', new Uint8Array([2]));
  await fs.write('z', new Uint8Array([3]));

  await test('FS: remove() deletes file', async () => {
    await fs.remove('y');
    const keys = await fs.list('');
    if (keys.includes('y')) throw new Error('File y still exists');
    if (!keys.includes('x') || !keys.includes('z'))
      throw new Error('Other files missing');
  });

  await fs.write('file/1', new Uint8Array([4]));
  await fs.write('file/2', new Uint8Array([5]));
  await fs.write('other/1', new Uint8Array([6]));

  await test('FS: removeAll(prefix) removes matching files', async () => {
    await fs.removeAll('file/');
    const keys = await fs.list('');
    if (keys.includes('file/1') || keys.includes('file/2')) {
      throw new Error('File keys still exist');
    }
    if (!keys.includes('other/1')) throw new Error('Other key missing');
  });

  await test('FS: removeAll() removes all files', async () => {
    await fs.removeAll();
    const keys = await fs.list('');
    if (keys.length !== 0) throw new Error('Files still exist');
  });

  await test('FS: remove() on non-existent key succeeds silently', async () => {
    await fs.remove('nonexistent');
  });

  await test('FS: removeAll() on empty directory succeeds', async () => {
    await fs.removeAll();
  });

  // Clean up
  rmSync(testDir, { recursive: true });

  console.log('\n' + '='.repeat(40));
  console.log('Passed:', passed);
  console.log('Failed:', failed);
  console.log('='.repeat(40));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
