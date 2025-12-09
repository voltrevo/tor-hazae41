import * as path from 'node:path';
import { createFsStorage } from './fs.js';
import type { IStorage } from './types.js';

export function createAutoStorage(name: string): IStorage {
  const dirPath = path.join('/tmp', name);
  return createFsStorage(dirPath);
}
