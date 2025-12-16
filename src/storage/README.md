# Storage Module

This module provides a simple key-value storage abstraction with three implementations:

- In-memory storage
- IndexedDB (browser)
- File system (Node.js)

## API

```typescript
interface IStorage {
  read: (key: string) => Promise<Uint8Array>;
  write: (key: string, value: Uint8Array) => Promise<void>;
  list: (keyPrefix: string) => Promise<string[]>;
  remove: (key: string) => Promise<void>;
  removeAll: (keyPrefix?: string) => Promise<void>;
}
```

## Usage

### Import

```typescript
import {
  MemoryStorage,
  createAutoStorage,
  type IStorage,
} from 'tor-js/storage';
```

**Development Note**: When developing within this repository, the `tsconfig.json` has a path mapping that resolves `tor-js/storage` to `./src/storage/index-node.ts` for Node.js environments. This allows you to use the same import path during development that consumers will use. The build process uses the conditional exports in `package.json` instead.

### Memory Storage

Available in all environments:

```typescript
const storage = new MemoryStorage();

await storage.write('key1', new Uint8Array([1, 2, 3]));
const data = await storage.read('key1');
const keys = await storage.list('key'); // Returns all keys starting with 'key'

// Remove a single key
await storage.remove('key1');

// Remove all keys with a prefix
await storage.removeAll('user/'); // Removes all keys starting with 'user/'

// Remove all keys
await storage.removeAll(); // or removeAll('')
```

### Auto Storage

Automatically uses the best available storage for the environment:

- **Browser**: IndexedDB
- **Node.js**: File system at `/tmp/<name>`

```typescript
const storage = createAutoStorage('my-app');

await storage.write('user/123', new Uint8Array([...]));
const data = await storage.read('user/123');
const userKeys = await storage.list('user/'); // List all keys starting with 'user/'
```

### Browser-Specific (IndexedDB)

Only available in browser environments:

```typescript
import { IndexedDBStorage } from 'tor-js/storage';

const storage = new IndexedDBStorage('my-database');
```

### Node.js-Specific (File System)

Only available in Node.js environments:

```typescript
import { FsStorage } from 'tor-js/storage';

// Direct path
const storage = new FsStorage('/path/to/storage');

// Or use temp directory
const storage = FsStorage.tmp('app-name');
```

## File System Implementation Details

The file system storage mangles keys to create filesystem-friendly filenames:

- Characters `a-z`, `A-Z`, `0-9` pass through unchanged
- Other characters are encoded as `_XX` (2 hex digits) or `_XXXX` (4 hex digits for unicode)
- Example: `user/data` → `user_2fdata`
- Example: `hello:world` → `hello_3aworld`

The mangling is bidirectional and preserves readability for alphanumeric keys.

## Conditional Exports

The package uses conditional exports to ensure:

- Browser builds don't include Node.js `fs` module
- Node.js builds don't include IndexedDB code

This is handled automatically by the module system.
