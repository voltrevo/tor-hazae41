// Example usage of the storage API
import { createMemoryStorage } from './memory.js';
import { createAutoStorage } from './index.js';

async function testMemoryStorage() {
  console.log('Testing memory storage...');
  const storage = createMemoryStorage();

  // Write some data
  await storage.write('user/123', new Uint8Array([1, 2, 3, 4, 5]));
  await storage.write('user/456', new Uint8Array([6, 7, 8, 9, 10]));
  await storage.write('config/app', new Uint8Array([11, 12, 13]));

  // Read data
  const userData = await storage.read('user/123');
  console.log('Read user/123:', userData);

  // List keys
  const userKeys = await storage.list('user/');
  console.log('User keys:', userKeys);

  const allKeys = await storage.list('');
  console.log('All keys:', allKeys);
}

async function testAutoStorage() {
  console.log('\nTesting auto storage...');
  const storage = createAutoStorage('test-app');

  // Write some data
  await storage.write('session/abc', new Uint8Array([20, 21, 22]));
  await storage.write('session/def', new Uint8Array([23, 24, 25]));

  // Read data
  const sessionData = await storage.read('session/abc');
  console.log('Read session/abc:', sessionData);

  // List keys
  const sessionKeys = await storage.list('session/');
  console.log('Session keys:', sessionKeys);
}

async function main() {
  await testMemoryStorage();
  await testAutoStorage();
  console.log('\nAll tests completed!');
}

main().catch(console.error);
