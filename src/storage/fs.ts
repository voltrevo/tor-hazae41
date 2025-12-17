import type { IStorage } from './types.js';
import { getNodeDeps } from './getNodeDeps.js';
import { Bytes } from '../hazae41/bytes/index.js';

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

export class FsStorage implements IStorage {
  private dirPath: string;
  private useTmp: boolean;
  private initialized = false;

  constructor(dirPath: string, useTmp: boolean = false) {
    this.dirPath = dirPath;
    this.useTmp = useTmp;
  }

  /**
   * Create FsStorage in system temp directory.
   * The path will be /tmp/{name}
   */
  static tmp(name: string): FsStorage {
    return new FsStorage(name, true);
  }

  private async ensureDir(): Promise<void> {
    if (!this.initialized) {
      const { fs } = await getNodeDeps();
      await fs.mkdir(await this.getPath(), { recursive: true });
      this.initialized = true;
    }
  }

  private async getPath(key?: string) {
    const { os, path } = await getNodeDeps();
    const fullDirPath = this.useTmp
      ? path.join(os.tmpdir(), this.dirPath)
      : this.dirPath;

    if (key === undefined) {
      return fullDirPath;
    }

    return path.join(fullDirPath, mangleKey(key));
  }

  async read(key: string): Promise<Bytes> {
    const { fs } = await getNodeDeps();
    await this.ensureDir();
    try {
      const data = await fs.readFile(await this.getPath(key));
      return Bytes.from(data);
    } catch (error) {
      if (isNodeFsError(error) && error.code === 'ENOENT') {
        throw new Error(`Key not found: ${key}`);
      }
      throw error;
    }
  }

  async write(key: string, value: Bytes): Promise<void> {
    const { fs } = await getNodeDeps();
    await this.ensureDir();
    await fs.writeFile(await this.getPath(key), value);
  }

  async list(keyPrefix: string): Promise<string[]> {
    const { fs } = await getNodeDeps();
    await this.ensureDir();
    try {
      const files = await fs.readdir(await this.getPath());
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
  }

  async remove(key: string): Promise<void> {
    const { fs } = await getNodeDeps();
    await this.ensureDir();
    try {
      await fs.unlink(await this.getPath(key));
    } catch (error) {
      if (isNodeFsError(error) && error.code === 'ENOENT') {
        // Key doesn't exist, silently succeed
        return;
      }
      throw error;
    }
  }

  async removeAll(keyPrefix: string = ''): Promise<void> {
    const { fs } = await getNodeDeps();
    await this.ensureDir();
    try {
      const files = await fs.readdir(await this.getPath());
      const keysToRemove = files
        .map(unmangleKey)
        .filter(key => key.startsWith(keyPrefix));

      await Promise.all(
        keysToRemove.map(async key =>
          fs.unlink(await this.getPath(key)).catch(error => {
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
  }
}
