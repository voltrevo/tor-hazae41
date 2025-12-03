import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IStorage } from './types.js';

/**
 * Mangles a key into a filesystem-friendly filename.
 * Maps characters to readable equivalents:
 * - a-z -> a-z
 * - A-Z -> A-Z
 * - 0-9 -> 0-9
 * - Other characters are encoded as _XX where XX is the hex code
 */
function mangleKey(key: string): string {
  let result = '';
  for (let i = 0; i < key.length; i++) {
    const char = key[i];
    const code = char.charCodeAt(0);

    // a-z, A-Z, 0-9 pass through unchanged
    if (
      (code >= 97 && code <= 122) || // a-z
      (code >= 65 && code <= 90) || // A-Z
      (code >= 48 && code <= 57) // 0-9
    ) {
      result += char;
    } else {
      // Encode as _XX or _XXXX for unicode
      if (code <= 0xff) {
        result += '_' + code.toString(16).padStart(2, '0');
      } else {
        result += '_' + code.toString(16).padStart(4, '0');
      }
    }
  }
  return result;
}

/**
 * Unmangles a filename back to the original key.
 */
function unmangleKey(filename: string): string {
  let result = '';
  let i = 0;
  while (i < filename.length) {
    if (filename[i] === '_') {
      // Peek ahead to determine if it's 2 or 4 hex digits
      let hexLen = 2;
      if (i + 4 < filename.length) {
        // Check if next 4 chars are all hex
        const next4 = filename.slice(i + 1, i + 5);
        if (/^[0-9a-f]{4}$/i.test(next4)) {
          const code = parseInt(next4, 16);
          if (code > 0xff) {
            hexLen = 4;
          }
        }
      }

      const hex = filename.slice(i + 1, i + 1 + hexLen);
      const code = parseInt(hex, 16);
      result += String.fromCharCode(code);
      i += 1 + hexLen;
    } else {
      result += filename[i];
      i++;
    }
  }
  return result;
}

export function createFsStorage(dirPath: string): IStorage {
  let initialized = false;

  async function ensureDir(): Promise<void> {
    if (!initialized) {
      await fs.mkdir(dirPath, { recursive: true });
      initialized = true;
    }
  }

  function getFilePath(key: string): string {
    return path.join(dirPath, mangleKey(key));
  }

  return {
    async read(key: string): Promise<Uint8Array> {
      await ensureDir();
      try {
        const data = await fs.readFile(getFilePath(key));
        return new Uint8Array(data);
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
          throw new Error(`Key not found: ${key}`);
        }
        throw error;
      }
    },

    async write(key: string, value: Uint8Array): Promise<void> {
      await ensureDir();
      await fs.writeFile(getFilePath(key), value);
    },

    async list(keyPrefix: string): Promise<string[]> {
      await ensureDir();
      try {
        const files = await fs.readdir(dirPath);
        const keys = files
          .map(unmangleKey)
          .filter(key => key.startsWith(keyPrefix))
          .sort();
        return keys;
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
          return [];
        }
        throw error;
      }
    },

    async remove(key: string): Promise<void> {
      await ensureDir();
      try {
        await fs.unlink(getFilePath(key));
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
          // Key doesn't exist, silently succeed
          return;
        }
        throw error;
      }
    },

    async removeAll(keyPrefix: string = ''): Promise<void> {
      await ensureDir();
      try {
        const files = await fs.readdir(dirPath);
        const keysToRemove = files
          .map(unmangleKey)
          .filter(key => key.startsWith(keyPrefix));

        await Promise.all(
          keysToRemove.map(key =>
            fs.unlink(getFilePath(key)).catch(error => {
              // Ignore ENOENT errors (file already deleted)
              if ((error as { code?: string }).code !== 'ENOENT') {
                throw error;
              }
            })
          )
        );
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') {
          // Directory doesn't exist, nothing to remove
          return;
        }
        throw error;
      }
    },
  };
}
