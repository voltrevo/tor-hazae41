import { Bytes } from '../hazae41/bytes/index.js';
import type { IStorage } from './types.js';

export class IndexedDBStorage implements IStorage {
  private dbName: string;
  private storeName = 'keyvalue';
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor(name: string) {
    this.dbName = `storage-${name}`;
  }

  private getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
      });
    }
    return this.dbPromise;
  }

  async read(key: string): Promise<Bytes> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        if (request.result === undefined) {
          reject(new Error(`Key not found: ${key}`));
        } else {
          resolve(request.result);
        }
      };
    });
  }

  async write(key: string, value: Bytes): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(value, key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async list(keyPrefix: string): Promise<string[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const allKeys = request.result as string[];
        const filtered = allKeys
          .filter(key => key.startsWith(keyPrefix))
          .sort();
        resolve(filtered);
      };
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async removeAll(keyPrefix: string = ''): Promise<void> {
    const db = await this.getDB();
    const keysToRemove = await this.list(keyPrefix);

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let errorOccurred = false;
      for (const key of keysToRemove) {
        const request = store.delete(key);
        request.onerror = () => {
          if (!errorOccurred) {
            errorOccurred = true;
            reject(request.error);
          }
        };
      }

      transaction.oncomplete = () => {
        if (!errorOccurred) {
          resolve();
        }
      };
      transaction.onerror = () => {
        if (!errorOccurred) {
          errorOccurred = true;
          reject(transaction.error);
        }
      };
    });
  }
}
