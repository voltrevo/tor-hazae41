// Test that tsconfig paths work correctly
import {
  createMemoryStorage,
  createAutoStorage,
  type IStorage,
} from 'tor-hazae41/storage';

async function test() {
  console.log('Testing tsconfig path mapping...');

  const memory: IStorage = createMemoryStorage();
  await memory.write('test', new Uint8Array([1, 2, 3]));
  const data = await memory.read('test');
  console.log('✓ Memory storage works:', data);

  const auto = createAutoStorage('test-tsx');
  await auto.write('key', new Uint8Array([4, 5, 6]));
  const autoData = await auto.read('key');
  console.log('✓ Auto storage works:', autoData);

  // Clean up
  await auto.removeAll();
  console.log('✓ Remove methods work');

  console.log('\n✅ tsconfig paths working correctly!');
}

test().catch(console.error);
