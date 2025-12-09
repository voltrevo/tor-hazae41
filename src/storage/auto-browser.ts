import { createIndexedDBStorage } from './indexeddb.js';
import type { IStorage } from './types.js';

export function createAutoStorage(name: string): IStorage {
  return createIndexedDBStorage(name);
}
