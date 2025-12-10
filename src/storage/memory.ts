import type { IStorage } from './types.js';
import { assert } from '../utils/assert.js';

export function createMemoryStorage(): IStorage {
  const data = new Map<string, Uint8Array>();

  return {
    async read(key: string): Promise<Uint8Array> {
      const value = data.get(key);
      assert(value !== undefined, `Key not found: ${key}`);
      return value;
    },

    async write(key: string, value: Uint8Array): Promise<void> {
      data.set(key, value);
    },

    async list(keyPrefix: string): Promise<string[]> {
      const keys: string[] = [];
      for (const key of data.keys()) {
        if (key.startsWith(keyPrefix)) {
          keys.push(key);
        }
      }
      return keys.sort();
    },

    async remove(key: string): Promise<void> {
      data.delete(key);
    },

    async removeAll(keyPrefix: string = ''): Promise<void> {
      const keysToRemove: string[] = [];
      for (const key of data.keys()) {
        if (key.startsWith(keyPrefix)) {
          keysToRemove.push(key);
        }
      }
      for (const key of keysToRemove) {
        data.delete(key);
      }
    },
  };
}
