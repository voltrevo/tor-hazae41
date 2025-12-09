import type { IStorage } from './types.js';

export function createIndexedDBStorage(name: string): IStorage {
  const dbName = `storage-${name}`;
  const storeName = 'keyvalue';
  let dbPromise: Promise<IDBDatabase> | null = null;

  function getDB(): Promise<IDBDatabase> {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = event => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(storeName)) {
            db.createObjectStore(storeName);
          }
        };
      });
    }
    return dbPromise;
  }

  return {
    async read(key: string): Promise<Uint8Array> {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
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
    },

    async write(key: string, value: Uint8Array): Promise<void> {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async list(keyPrefix: string): Promise<string[]> {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
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
    },

    async remove(key: string): Promise<void> {
      const db = await getDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    },

    async removeAll(keyPrefix: string = ''): Promise<void> {
      const db = await getDB();
      const keysToRemove = await this.list(keyPrefix);

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);

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
    },
  };
}
