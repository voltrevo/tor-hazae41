import type { IStorage } from './types.js';
import { assert } from '../utils/assert.js';
import { Bytes } from '../hazae41/bytes/index.js';

export class MemoryStorage implements IStorage {
  private data = new Map<string, Bytes>();

  async read(key: string): Promise<Bytes> {
    const value = this.data.get(key);
    assert(value !== undefined, `Key not found: ${key}`);
    return value;
  }

  async write(key: string, value: Bytes): Promise<void> {
    this.data.set(key, value);
  }

  async list(keyPrefix: string): Promise<string[]> {
    const keys: string[] = [];
    for (const key of this.data.keys()) {
      if (key.startsWith(keyPrefix)) {
        keys.push(key);
      }
    }
    return keys.sort();
  }

  async remove(key: string): Promise<void> {
    this.data.delete(key);
  }

  async removeAll(keyPrefix: string = ''): Promise<void> {
    const keysToRemove: string[] = [];
    for (const key of this.data.keys()) {
      if (key.startsWith(keyPrefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      this.data.delete(key);
    }
  }
}
