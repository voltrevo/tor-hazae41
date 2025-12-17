import { test } from '../hazae41/phobos/mod';
import { assert } from '../utils/assert';
import { rmSync } from 'fs';
import { createAutoStorage, MemoryStorage, type IStorage } from './index.js';
import { Bytes } from '../hazae41/bytes';

test('tsconfig path mapping: memory storage', async () => {
  const memory: IStorage = new MemoryStorage();

  await memory.write('test', Bytes.from([1, 2, 3]));
  const data = await memory.read('test');

  assert(data.length === 3, 'Should read 3 bytes');
  assert(data[0] === 1 && data[1] === 2 && data[2] === 3, 'Data should match');
});

test('tsconfig path mapping: auto storage', async () => {
  const testDir = '/tmp/test-tsx';

  try {
    rmSync(testDir, { recursive: true });
  } catch {
    //
  }

  const auto = createAutoStorage('test-tsx');

  await auto.write('key', Bytes.from([4, 5, 6]));
  const autoData = await auto.read('key');

  assert(autoData.length === 3, 'Should read 3 bytes');
  assert(
    autoData[0] === 4 && autoData[1] === 5 && autoData[2] === 6,
    'Data should match'
  );

  await auto.removeAll();
  const keys = await auto.list('');

  assert(keys.length === 0, 'removeAll should work');

  rmSync(testDir, { recursive: true });
});
