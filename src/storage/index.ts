export type { IStorage } from './types.js';
export { createMemoryStorage } from './memory.js';
export { createIndexedDBStorage } from './indexeddb.js';
export { createFsStorage } from './fs.js';

import type { IStorage } from './types.js';
import { createIndexedDBStorage } from './indexeddb.js';
import { createFsStorage } from './fs.js';

/**
 * Detects if the runtime environment is a browser.
 */
function isBrowserEnvironment(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.indexedDB !== 'undefined'
  );
}

/**
 * Detects if the runtime environment is Node.js.
 */
function isNodeEnvironment(): boolean {
  return (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.process !== 'undefined' &&
    globalThis.process.versions?.node !== undefined
  );
}

/**
 * Creates an appropriate storage backend for the current environment.
 * In browser environments, uses IndexedDB for persistence.
 * In Node.js environments, uses filesystem storage in the system temp directory/{name}.
 * Throws an error if neither environment can be detected.
 */
export function createAutoStorage(name: string): IStorage {
  if (isBrowserEnvironment()) {
    return createIndexedDBStorage(name);
  }

  if (isNodeEnvironment()) {
    return createFsStorage(name, true);
  }

  throw new Error(
    'No persistent storage backend available: IndexedDB (browser) and filesystem (Node.js) not detected'
  );
}
