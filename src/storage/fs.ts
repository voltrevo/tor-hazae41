import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IStorage } from './types.js';

/**
 * Type guard to check if an error is a Node.js filesystem error with code property
 */
function isNodeFsError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

/**
 * Mangles a key into a filesystem-friendly filename.
 * Maps characters to readable equivalents:
 * - a-z -> a-z
 * - A-Z -> A-Z
 * - 0-9 -> 0-9
 * - Other characters are encoded as _XX_ (with trailing underscore) for 2-digit hex
 *   or _XXXX_ (with trailing underscore) for 4-digit unicode
 *
 * The trailing underscore makes the encoding unambiguous and easier to parse.
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
      // Encode as _XX_ or _XXXX_ for unicode (with trailing underscore delimiter)
      if (code <= 0xff) {
        result += '_' + code.toString(16).padStart(2, '0') + '_';
      } else {
        result += '_' + code.toString(16).padStart(4, '0') + '_';
      }
    }
  }
  return result;
}

/**
 * Unmangles a filename back to the original key.
 * The new mangling scheme uses _XX_ for chars <= 0xFF and _XXXX_ for unicode chars > 0xFF.
 * The trailing underscore delimiter makes parsing unambiguous.
 */
function unmangleKey(filename: string): string {
  let result = '';
  let i = 0;
  while (i < filename.length) {
    if (filename[i] === '_') {
      // Look for _XX_ or _XXXX_ pattern

      // Try 4-digit first (_XXXX_)
      if (i + 5 < filename.length && filename[i + 5] === '_') {
        const hex4 = filename.slice(i + 1, i + 5);
        if (/^[0-9a-f]{4}$/i.test(hex4)) {
          const code = parseInt(hex4, 16);
          result += String.fromCharCode(code);
          i += 6; // Skip _XXXX_
          continue;
        }
      }

      // Try 2-digit (_XX_)
      if (i + 3 < filename.length && filename[i + 3] === '_') {
        const hex2 = filename.slice(i + 1, i + 3);
        if (/^[0-9a-f]{2}$/i.test(hex2)) {
          const code = parseInt(hex2, 16);
          result += String.fromCharCode(code);
          i += 4; // Skip _XX_
          continue;
        }
      }

      // Not a valid encoding pattern, treat '_' literally
      result += '_';
      i++;
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
        if (isNodeFsError(error) && error.code === 'ENOENT') {
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
        if (isNodeFsError(error) && error.code === 'ENOENT') {
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
        if (isNodeFsError(error) && error.code === 'ENOENT') {
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
              if (isNodeFsError(error) && error.code === 'ENOENT') {
                return;
              }
              throw error;
            })
          )
        );
      } catch (error) {
        if (isNodeFsError(error) && error.code === 'ENOENT') {
          // Directory doesn't exist, nothing to remove
          return;
        }
        throw error;
      }
    },
  };
}
